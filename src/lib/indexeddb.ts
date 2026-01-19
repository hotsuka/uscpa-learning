/**
 * IndexedDB ユーティリティ
 * PDFファイルなどの大きなバイナリデータを永続化するために使用
 */

const DB_NAME = "uscpa-learning-db"
const DB_VERSION = 1
const STORE_NAME = "pdf-files"

interface StoredPDF {
  id: string // materialId + "-without" or materialId + "-with"
  data: ArrayBuffer
  mimeType: string
}

/**
 * IndexedDBを開く
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is not available on server"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
  })
}

/**
 * PDFファイルをIndexedDBに保存
 */
export async function savePDFToIndexedDB(
  materialId: string,
  file: File,
  type: "without" | "with"
): Promise<void> {
  const db = await openDB()
  const arrayBuffer = await file.arrayBuffer()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    const storedPDF: StoredPDF = {
      id: `${materialId}-${type}`,
      data: arrayBuffer,
      mimeType: file.type || "application/pdf",
    }

    const request = store.put(storedPDF)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve()
    }

    transaction.oncomplete = () => {
      db.close()
    }
  })
}

/**
 * IndexedDBからPDFファイルを取得してBlob URLを作成
 */
export async function getPDFFromIndexedDB(
  materialId: string,
  type: "without" | "with"
): Promise<string | null> {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(`${materialId}-${type}`)

      request.onerror = () => {
        reject(request.error)
      }

      request.onsuccess = () => {
        const storedPDF = request.result as StoredPDF | undefined
        if (storedPDF) {
          const blob = new Blob([storedPDF.data], { type: storedPDF.mimeType })
          const url = URL.createObjectURL(blob)
          resolve(url)
        } else {
          resolve(null)
        }
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    console.error("Error getting PDF from IndexedDB:", error)
    return null
  }
}

/**
 * IndexedDBからPDFファイルを削除
 */
export async function deletePDFFromIndexedDB(
  materialId: string,
  type: "without" | "with"
): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(`${materialId}-${type}`)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve()
    }

    transaction.oncomplete = () => {
      db.close()
    }
  })
}

/**
 * 教材に関連する全てのPDFを削除
 */
export async function deleteAllPDFsForMaterial(materialId: string): Promise<void> {
  await Promise.all([
    deletePDFFromIndexedDB(materialId, "without"),
    deletePDFFromIndexedDB(materialId, "with"),
  ])
}
