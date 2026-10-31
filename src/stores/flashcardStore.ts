import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FlashcardReview } from "@/types/flashcards";

interface FlashcardState {
  /** 自己採点の記録（古い順） */
  reviews: FlashcardReview[];
  addReview: (review: FlashcardReview) => void;
}

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    (set) => ({
      reviews: [],

      addReview: (review) => {
        set((state) => ({ reviews: [...state.reviews, review] }));
      },
    }),
    {
      name: "uscpa-flashcards",
      version: 1,
    },
  ),
);
