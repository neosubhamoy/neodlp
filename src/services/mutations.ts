import { VideoInfo } from "@/types/video";
import { useMutation } from "@tanstack/react-query";
import { deleteDownloadState, deleteKvPair, resetSettings, saveDownloadState, saveKvPair, savePlaylistInfo, saveSettingsKey, saveVideoInfo, updateDownloadFilePath, updateDownloadStatus } from "@/services/database";
import { DownloadState } from "@/types/download";
import { PlaylistInfo } from "@/types/playlist";

export function useSaveVideoInfo() {
    return useMutation({
        mutationFn: (data: VideoInfo) => saveVideoInfo(data)
    })
}

export function useSavePlaylistInfo() {
    return useMutation({
        mutationFn: (data: PlaylistInfo) => savePlaylistInfo(data)
    })
}

export function useSaveDownloadState() {
    return useMutation({
        mutationFn: (data: DownloadState) => saveDownloadState(data)
    })
}

export function useUpdateDownloadStatus() {
    return useMutation({
        mutationFn: (data: { download_id: string; download_status: string }) =>
        updateDownloadStatus(data.download_id, data.download_status)
    })
}

export function useUpdateDownloadFilePath() {
    return useMutation({
        mutationFn: (data: { download_id: string; filepath: string, ext: string }) =>
        updateDownloadFilePath(data.download_id, data.filepath, data.ext)
    })
}

export function useDeleteDownloadState() {
    return useMutation({
        mutationFn: (data: string) => deleteDownloadState(data)
    })
}

export function useSaveSettingsKey() {
    return useMutation({
        mutationFn: (data: { key: string; value: unknown }) => saveSettingsKey(data.key, data.value)
    })
}

export function useResetSettings() {
    return useMutation({
        mutationFn: () => resetSettings()
    })
}

export function useSaveKvPair() {
    return useMutation({
        mutationFn: (data: { key: string; value: unknown }) => saveKvPair(data.key, data.value)
    })
}

export function useDeleteKvPair() {
    return useMutation({
        mutationFn: (key: string) => deleteKvPair(key)
    })
}
