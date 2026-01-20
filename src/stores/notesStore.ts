import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Subject, StudyNote, NoteType } from "@/types"
import { generateUUID, getDeviceId } from "@/lib/utils"

// ノート作成時の入力データ
interface NoteInput {
  noteType?: NoteType  // デフォルトは "note"
  title: string
  content: string | null
  subject: Subject | null
  tags: string[]
  // ページメモ用（v1.11追加）
  materialId?: string | null
  pageNumber?: number | null
}

interface NotesState {
  notes: StudyNote[]

  // Notion同期用
  isSyncing: boolean
  lastSyncedAt: string | null
  notionIdMap: Record<string, string>

  // アクション
  addNote: (note: NoteInput) => StudyNote
  updateNote: (id: string, updates: Partial<Omit<StudyNote, "id" | "createdAt" | "updatedAt" | "deviceId">>) => void
  deleteNote: (id: string) => void
  getNoteById: (id: string) => StudyNote | undefined

  // Notion同期アクション
  syncNoteToNotion: (note: StudyNote) => Promise<string | null>
  fetchNotesFromNotion: () => Promise<void>
  deleteNoteFromNotion: (id: string) => Promise<void>

  // フィルタリング
  getNotesBySubject: (subject: Subject) => StudyNote[]
  searchNotes: (query: string) => StudyNote[]
  // ページメモ用（v1.11追加）
  getPageMemosByMaterial: (materialId: string) => StudyNote[]
  getPageMemoByPage: (materialId: string, pageNumber: number) => StudyNote | undefined
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
          id: generateUUID(),
          noteType: noteData.noteType ?? "note",
          title: noteData.title,
          content: noteData.content,
          subject: noteData.subject,
          tags: noteData.tags,
          materialId: noteData.materialId ?? null,
          pageNumber: noteData.pageNumber ?? null,
          deviceId: getDeviceId(),
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
              noteId: note.id,
              noteType: note.noteType,
              title: note.title,
              subject: note.subject,
              content: note.content,
              tags: note.tags,
              materialId: note.materialId,
              pageNumber: note.pageNumber,
              deviceId: note.deviceId,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
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

            // 既存のローカルノートとマージ（Last-Write-Wins戦略）
            const localNotes = get().notes
            const existingNotionIdMap = get().notionIdMap
            const newNotionIdMap: Record<string, string> = { ...existingNotionIdMap }

            // NotionノートのIDでマップを作成
            const notionNoteMap = new Map<string, StudyNote>()
            for (const note of notionNotes) {
              notionNoteMap.set(note.id, note)
              newNotionIdMap[note.id] = note.id
            }

            // マージされたノートリスト
            const mergedNotes: StudyNote[] = []

            // ローカルノートを処理
            for (const localNote of localNotes) {
              const notionId = existingNotionIdMap[localNote.id]
              if (notionId && notionNoteMap.has(notionId)) {
                // Notionにも存在する → updatedAtで比較（Last-Write-Wins）
                const notionNote = notionNoteMap.get(notionId)!
                const localUpdated = new Date(localNote.updatedAt).getTime()
                const notionUpdated = new Date(notionNote.updatedAt).getTime()

                if (localUpdated >= notionUpdated) {
                  // ローカルが新しい → ローカルを採用
                  mergedNotes.push(localNote)
                } else {
                  // Notionが新しい → Notionを採用
                  mergedNotes.push(notionNote)
                }
                // 処理済みとしてマップからNotionノートを削除
                notionNoteMap.delete(notionId)
              } else {
                // まだNotion同期されていないローカルノート、または
                // notionIdマッピングがあるがNotion側にない場合 → ローカルを保持
                // （ローカルデータを優先保護）
                mergedNotes.push(localNote)
              }
            }

            // Notionにのみ存在するノートを追加
            for (const notionNote of notionNoteMap.values()) {
              mergedNotes.push(notionNote)
            }

            // 日付の新しい順にソート
            mergedNotes.sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )

            set({
              notes: mergedNotes,
              notionIdMap: newNotionIdMap,
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

      // ページメモ用（v1.11追加）
      getPageMemosByMaterial: (materialId) => {
        return get().notes.filter(
          (note) => note.noteType === "page_memo" && note.materialId === materialId
        ).sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))
      },

      getPageMemoByPage: (materialId, pageNumber) => {
        return get().notes.find(
          (note) =>
            note.noteType === "page_memo" &&
            note.materialId === materialId &&
            note.pageNumber === pageNumber
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
