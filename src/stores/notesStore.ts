import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Subject, StudyNote } from "@/types"

interface NotesState {
  notes: StudyNote[]

  // アクション
  addNote: (note: Omit<StudyNote, "id" | "createdAt" | "updatedAt">) => StudyNote
  updateNote: (id: string, updates: Partial<Omit<StudyNote, "id" | "createdAt" | "updatedAt">>) => void
  deleteNote: (id: string) => void
  getNoteById: (id: string) => StudyNote | undefined

  // フィルタリング
  getNotesBySubject: (subject: Subject) => StudyNote[]
  searchNotes: (query: string) => StudyNote[]
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],

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
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
        }))
      },

      getNoteById: (id) => {
        return get().notes.find((note) => note.id === id)
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
    }
  )
)
