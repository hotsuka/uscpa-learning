import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Subject, StudyNote } from "@/types"

interface NotesState {
  notes: StudyNote[]

  // Notion同期用
  isSyncing: boolean
  lastSyncedAt: string | null
  notionIdMap: Record<string, string>

  // アクション
  addNote: (note: Omit<StudyNote, "id" | "createdAt" | "updatedAt">) => StudyNote
  updateNote: (id: string, updates: Partial<Omit<StudyNote, "id" | "createdAt" | "updatedAt">>) => void
  deleteNote: (id: string) => void
  getNoteById: (id: string) => StudyNote | undefined

  // Notion同期アクション
  syncNoteToNotion: (note: StudyNote) => Promise<string | null>
  fetchNotesFromNotion: () => Promise<void>
  deleteNoteFromNotion: (id: string) => Promise<void>

  // フィルタリング
  getNotesBySubject: (subject: Subject) => StudyNote[]
  searchNotes: (query: string) => StudyNote[]
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],

      // Notion同期用
      isSyncing: false,
      lastSyncedAt: null,
      notionIdMap: {},

      addNote: (noteData) => {
        const now = new Date().toISOString()
        const newNote: StudyNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          ...noteData,
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({
          notes: [newNote, ...state.notes],
        }))

        // バックグラウンドでNotion同期
        get().syncNoteToNotion(newNote).catch(console.error)

        return newNote
      },

      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? { ...note, ...updates, updatedAt: new Date().toISOString() }
              : note
          ),
        }))

        // NotionページIDがあれば同期
        const notionId = get().notionIdMap[id]
        if (notionId) {
          const note = get().getNoteById(id)
          if (note) {
            fetch("/api/notion/notes", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: notionId,
                title: note.title,
                subject: note.subject,
                content: note.content,
                tags: note.tags,
              }),
            }).catch(console.error)
          }
        }
      },

      deleteNote: (id) => {
        // Notionから削除
        get().deleteNoteFromNotion(id).catch(console.error)

        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
          notionIdMap: Object.fromEntries(
            Object.entries(state.notionIdMap).filter(([key]) => key !== id)
          ),
        }))
      },

      getNoteById: (id) => {
        return get().notes.find((note) => note.id === id)
      },

      // Notion同期アクション
      syncNoteToNotion: async (note) => {
        try {
          const response = await fetch("/api/notion/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: note.title,
              subject: note.subject,
              content: note.content,
              tags: note.tags,
            }),
          })

          if (response.ok) {
            const result = await response.json()
            set((state) => ({
              notionIdMap: {
                ...state.notionIdMap,
                [note.id]: result.id,
              },
            }))
            return result.id
          }
          return null
        } catch (error) {
          console.error("Failed to sync note to Notion:", error)
          return null
        }
      },

      fetchNotesFromNotion: async () => {
        set({ isSyncing: true })

        try {
          const response = await fetch("/api/notion/notes")
          if (response.ok) {
            const notionNotes: StudyNote[] = await response.json()

            // 既存のローカルノートとマージ
            const localNotes = get().notes
            const notionIdMap: Record<string, string> = {}

            // NotionのIDをローカルIDとしても使用
            for (const note of notionNotes) {
              notionIdMap[note.id] = note.id
            }

            // ローカルにのみ存在するノート（まだNotion同期されていない）を保持
            const localOnlyNotes = localNotes.filter(
              (local) => !Object.keys(get().notionIdMap).includes(local.id)
            )

            set({
              notes: [...notionNotes, ...localOnlyNotes],
              notionIdMap: { ...get().notionIdMap, ...notionIdMap },
              lastSyncedAt: new Date().toISOString(),
            })
          }
        } catch (error) {
          console.error("Failed to fetch notes from Notion:", error)
        } finally {
          set({ isSyncing: false })
        }
      },

      deleteNoteFromNotion: async (id) => {
        const notionId = get().notionIdMap[id]
        if (!notionId) return

        try {
          await fetch(`/api/notion/notes?id=${notionId}`, {
            method: "DELETE",
          })
        } catch (error) {
          console.error("Failed to delete note from Notion:", error)
        }
      },

      getNotesBySubject: (subject) => {
        return get().notes.filter((note) => note.subject === subject)
      },

      searchNotes: (query) => {
        const lowerQuery = query.toLowerCase()
        return get().notes.filter(
          (note) =>
            note.title.toLowerCase().includes(lowerQuery) ||
            (note.content?.toLowerCase().includes(lowerQuery) ?? false) ||
            note.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        )
      },
    }),
    {
      name: "uscpa-notes",
      partialize: (state) => ({
        notes: state.notes,
        notionIdMap: state.notionIdMap,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
)
