import { RoutesObj } from "@/types/route";
import { AllRoutes } from "@/routes";
import { DownloadProgress, Paginated } from "@/types/download";
import { RawVideoInfo, VideoFormat, VideoSubtitle } from "@/types/video";
import * as fs from "@tauri-apps/plugin-fs";
import { fetchDownloadStateById } from "@/services/database";

export function isActive(path: string, location: string, starts_with: boolean = false): boolean {
  if (starts_with) {
    return location.startsWith(path) ? true : false;
  }
  return path === location ? true : false;
}

export function getRouteName(location: string, routes: Array<RoutesObj> = AllRoutes): string {
  const route = routes.find(route => route.url === location);
  if (route) {
    return route.title;
  }
  const parts = location.split('/');
  const lastPart = parts[parts.length - 1];
  return lastPart ? lastPart.toUpperCase() : 'Dashboard';
}

const convertToBytes = (value: number, unit: string): number => {
  switch (unit) {
    case 'B':
      return value;
    case 'KiB':
      return value * 1024;
    case 'MiB':
      return value * 1024 * 1024;
    case 'GiB':
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
};

export const parseProgressLine = async (line: string, downloadID: string): Promise<DownloadProgress> => {
  const state = await fetchDownloadStateById(downloadID);
  const progress: Partial<DownloadProgress> = {
    status: 'downloading',
    item: state?.item || null,
  };

  // Check if line contains both aria2c and yt-dlp format (combined format)
  if (line.includes(']status:')) {
    // Extract the status part after the closing bracket
    const statusIndex = line.indexOf(']status:');
    if (statusIndex !== -1) {
      const statusPart = line.substring(statusIndex + 1); // +1 to skip the ']'
      // Parse the yt-dlp format part
      statusPart.split(',').forEach(pair => {
        const [key, value] = pair.split(':');
        if (key && value) {
          switch (key.trim()) {
            case 'status':
              progress.status = value.trim();
              break;
            case 'progress':
              progress.progress = parseFloat(value.replace('%', '').trim());
              break;
            case 'speed':
              progress.speed = parseFloat(value);
              break;
            case 'downloaded':
              progress.downloaded = parseInt(value, 10);
              break;
            case 'total':
              progress.total = parseInt(value, 10);
              break;
            case 'eta':
              if (value.trim() !== 'NA') {
                progress.eta = parseInt(value, 10);
              }
              break;
          }
        }
      });
    }
    return progress as DownloadProgress;
  }

  // Check if line is aria2c format only
  if (line.startsWith('[#') && line.includes('MiB') && line.includes('%')) {
    // Parse aria2c format: [#99f72b 2.5MiB/3.4MiB(75%) CN:1 DL:503KiB ETA:1s]

    // Extract progress percentage
    const progressMatch = line.match(/\((\d+(?:\.\d+)?)%\)/);
    if (progressMatch) {
      progress.progress = parseFloat(progressMatch[1]);
    }

    // Extract downloaded/total sizes
    const sizeMatch = line.match(/(\d+(?:\.\d+)?)(MiB|KiB|GiB|B)\/(\d+(?:\.\d+)?)(MiB|KiB|GiB|B)/);
    if (sizeMatch) {
      const downloaded = parseFloat(sizeMatch[1]);
      const downloadedUnit = sizeMatch[2];
      const total = parseFloat(sizeMatch[3]);
      const totalUnit = sizeMatch[4];

      // Convert to bytes
      progress.downloaded = convertToBytes(downloaded, downloadedUnit);
      progress.total = convertToBytes(total, totalUnit);
    }

    // Extract download speed
    const speedMatch = line.match(/DL:(\d+(?:\.\d+)?)(KiB|MiB|GiB|B)/);
    if (speedMatch) {
      const speed = parseFloat(speedMatch[1]);
      const speedUnit = speedMatch[2];
      progress.speed = convertToBytes(speed, speedUnit);
    }

    // Extract ETA
    const etaMatch = line.match(/ETA:(\d+)s/);
    if (etaMatch) {
      progress.eta = parseInt(etaMatch[1], 10);
    }

    return progress as DownloadProgress;
  }

  // Original yt-dlp format: status:downloading,progress: 75.1%,speed:1022692.427018,downloaded:30289474,total:40331784,eta:9
  line.split(',').forEach(pair => {
    const [key, value] = pair.split(':');
    if (key && value) {
      switch (key.trim()) {
        case 'status':
          progress.status = value.trim();
          break;
        case 'progress':
          progress.progress = parseFloat(value.replace('%', '').trim());
          break;
        case 'speed':
          progress.speed = parseFloat(value);
          break;
        case 'downloaded':
          progress.downloaded = parseInt(value, 10);
          break;
        case 'total':
          progress.total = parseInt(value, 10);
          break;
        case 'eta':
          if (value.trim() !== 'NA') {
            progress.eta = parseInt(value, 10);
          }
          break;
      }
    }
  });

  return progress as DownloadProgress;
};

export const extractPlaylistItemProgress = (line: string): string | null => {
    const match = line.match(/\[download\] Downloading item (\d+) of (\d+)/);
    if (match) return `${match[1]}/${match[2]}`;
    return null;
}

export const formatSpeed = (bytes: number) => {
  if (bytes === 0) return '0 B/s';
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatFileSize = (bytes: number) => {
  if (!bytes) return 'Unknown';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatYtStyleCount = (count: number) => {
  if (count < 1000) return count;
  const sizes = ['', 'K', 'M', 'B', 'T'];
  const i = Math.floor(Math.log(count) / Math.log(1000));
  return `${(count / Math.pow(1000, i)).toFixed(1)} ${sizes[i]}`;
}

export const formatDurationString = (duration: string) => {
  const parts = duration.split(':');
  if (parts.length === 3) {
    return `${parts[0]}:${parts[1]}:${parts[2]}`;
  }
  if (parts.length === 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return `00:${duration}`;
}

export const formatReleaseDate = (date: string) => {
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = date.substr(0, 4);
  const monthNum = parseInt(date.substr(4, 2), 10);
  const day = date.substr(6, 2);
  const month = months[monthNum] || 'Unknown';
  return `${day} ${month} ${year}`;
}

export const formatSecToTimeString = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours ? hours + ':' : ''}${minutes < 10 ? '0' + minutes : minutes}:${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}`;
}

export const formatBitrate = (bitrate: number) => {
  if (bitrate < 1000) return `${bitrate.toFixed(1)} Kbps`;
  return `${(bitrate / 1000).toFixed(1)} Mbps`;
}

export const formatCodec = (codec: string) => {
  codec = codec.split('.')[0];
  return codec.toUpperCase();
}

export const generateID = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const generateDownloadId = (videoId: string, host: string) => {
  host = host.trim().split('.')[0];
  return `${host}_${videoId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateVideoId = (videoId: string, host: string) => {
  let hostParts = host.trim().split('.');
  hostParts.pop();
  host = hostParts.join('_');
  return `${host}_${videoId}`;
}

export const generateVideoTitle = () => {
  return `untitled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const generateSafeFilePath = async (filePath: string) => {
  let i = 1;
  let newFilePath = filePath;
  while (await fs.exists(newFilePath)) {
    const parts = filePath.split('.');
    const ext = parts.pop();
    newFilePath = `${parts.join('.')}_(${i}).${ext}`;
    i++;
  }
  return newFilePath;
}

export const isObjEmpty = (obj: Record<string, any>) => {
  return Object.keys(obj).length === 0;
}

// Helper function to escape special characters in a string for use in RegExp
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const sanitizeFilename = (
  input: string,
  replacement: string = '_',
  maxLength: number = 255
): string => {
  if (!input || typeof input !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  if (replacement.length !== 1 || /[<>:"/\\|?*\x00-\x1F]/.test(replacement)) {
    throw new Error('Replacement must be a single valid character');
  }

  if (maxLength <= 0 || !Number.isInteger(maxLength)) {
    throw new Error('Max length must be a positive integer');
  }

  // Windows has a maximum path of 260, but we're just sanitizing the filename part
  // macOS HFS+ has a limit of 255 characters
  // Linux ext4 has a limit of 255 bytes
  const MAX_SAFE_LENGTH = Math.min(maxLength, 255);

  // Reserved filenames in Windows
  const WINDOWS_RESERVED = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ]);

  // Reserved characters in various OS
  // Windows: < > : " / \ | ? *
  // macOS: : /
  // Linux: /
  // Also remove control characters (0x00-0x1F)
  let sanitized = input
    // Replace characters illegal in Windows, macOS, Linux with the replacement
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, replacement)
    // Collapse multiple consecutive replacements
    .replace(new RegExp(`${escapeRegExp(replacement)}+`, 'g'), replacement)
    // Trim spaces and dots from beginning and end (problematic in Windows especially)
    .replace(/^[.\s]+|[.\s]+$/g, '');

  // Check for Windows reserved names (exact match or with extension)
  const basePart = sanitized.split('.')[0].toUpperCase();
  if (WINDOWS_RESERVED.has(basePart)) {
    sanitized = `${replacement}${sanitized}`;
  }

  // Ensure we don't create a hidden file (starting with .)
  if (sanitized.startsWith('.')) {
    sanitized = `${replacement}${sanitized.substring(1)}`;
  }

  // Handle empty filename after sanitization
  if (sanitized.length === 0) {
    sanitized = 'unnamed_file';
  }

  // Truncate if longer than maximum safe length
  if (sanitized.length > MAX_SAFE_LENGTH) {
    // If there's an extension, preserve it when truncating
    const lastDotIndex = sanitized.lastIndexOf('.');
    if (lastDotIndex > 0 && lastDotIndex < sanitized.length - 1) {
      const extension = sanitized.substring(lastDotIndex);
      // If the extension itself is too long, truncate it too
      if (extension.length >= MAX_SAFE_LENGTH - 1) {
        sanitized = sanitized.substring(0, MAX_SAFE_LENGTH);
      } else {
        // Preserve extension, truncate name part
        const maxNameLength = MAX_SAFE_LENGTH - extension.length;
        sanitized = sanitized.substring(0, maxNameLength) + extension;
      }
    } else {
      // No extension, simple truncation
      sanitized = sanitized.substring(0, MAX_SAFE_LENGTH);
    }
  }

  return sanitized;
}

export const determineFileType = (
  vcodec: string | null | undefined,
  acodec: string | null | undefined
) => {
  const videoCodec = (vcodec || '').toLowerCase();
  const audioCodec = (acodec || '').toLowerCase();

  const isNone = (str: string): boolean => {
    return ['none', 'auto', 'n/a', '-', ''].includes(str);
  };

  const hasVideo = !isNone(videoCodec);
  const hasAudio = !isNone(audioCodec);

  if (hasVideo && hasAudio) {
    return 'video+audio';
  } else if (hasVideo) {
    return 'video';
  } else if (hasAudio) {
    return 'audio';
  } else {
    return 'unknown';
  }
};

export const fileFormatFilter = (filterType: 'video+audio' | 'video' | 'audio' | 'subtitles' | 'any') => {
  return (format: VideoFormat): boolean => {
    const videoExt = (format.video_ext || '').toLowerCase();
    const audioExt = (format.audio_ext || '').toLowerCase();
    const videoCodec = (format.vcodec || '').toLowerCase();
    const audioCodec = (format.acodec || '').toLowerCase();

    const isNone = (str: string): boolean => {
      return ['none', 'n/a', '-', ''].includes(str);
    };

    const subtitleExts = ['srt', 'vtt', 'ass', 'ssa', 'sub', 'sbv'];
    const isSubtitle = subtitleExts.includes(format.ext);

    const hasVideo = !isNone(videoExt) || !isNone(videoCodec);
    const hasAudio = !isNone(audioExt) || !isNone(audioCodec);

    switch (filterType) {
      case 'video+audio':
        return hasVideo && hasAudio;
      case 'video':
        return hasVideo && !hasAudio;
      case 'audio':
        return !hasVideo && hasAudio;
      case 'subtitles':
        return isSubtitle;
      case 'any':
      default:
        return true;
    }
  };
};

export const sortByBitrate = (formats: VideoFormat[] | undefined) => {
  return formats?.sort((a, b) => {
    // If both have tbr, compare them (higher first)
    if (a.tbr != null && b.tbr != null) {
      return b.tbr - a.tbr;
    }
    // If only one has tbr, put the one with tbr first
    if (a.tbr != null) return -1;
    if (b.tbr != null) return 1;
    // If neither has tbr, maintain original order
    return 0;
  });
};

export const paginate = <T>(items: T[], currentPage: number, itemsPerPage: number): Paginated<T> => {
    const total = items.length;
    const lastPage = Math.max(1, Math.ceil(total / itemsPerPage));

    // Clamp current page to valid range
    const validCurrentPage = Math.max(1, Math.min(currentPage, lastPage));

    // Calculate start and end indices
    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, total);

    // Get paginated data
    const data = items.slice(startIndex, endIndex);

    // Calculate from/to (1-indexed)
    const from = total > 0 ? startIndex + 1 : 0;
    const to = total > 0 ? endIndex : 0;

    // Generate pages array
    const pages: Array<{ label: string; page: number; active: boolean }> = [];
    for (let i = 1; i <= lastPage; i++) {
        pages.push({
            label: i.toString(),
            page: i,
            active: i === validCurrentPage
        });
    }

    return {
        current_page: validCurrentPage,
        from,
        first_page: 1,
        last_page: lastPage,
        pages,
        next_page: validCurrentPage < lastPage ? validCurrentPage + 1 : null,
        per_page: itemsPerPage,
        prev_page: validCurrentPage > 1 ? validCurrentPage - 1 : null,
        to,
        total,
        data
    };
};

export const getCommonFormats = (
  entries: RawVideoInfo[],
  selectedIndices: string[]
): VideoFormat[] => {
  // If no videos selected or only one video, return empty or all formats
  if (!entries || entries.length === 0 || selectedIndices.length === 0) {
    return [];
  }

  // Get the selected videos (convert 1-indexed strings to 0-indexed numbers)
  const selectedVideos = selectedIndices
    .map(index => entries[Number(index) - 1])
    .filter(video => video && video.formats);

  if (selectedVideos.length === 0) {
    return [];
  }

  // If only one video selected, return all its formats
  if (selectedVideos.length === 1) {
    return selectedVideos[0].formats || [];
  }

  // Get format_ids from the first selected video as the base set
  const firstVideoFormats = selectedVideos[0].formats || [];
  const firstVideoFormatIds = new Set(firstVideoFormats.map(f => f.format_id));

  // Find format_ids that exist in ALL selected videos
  const commonFormatIds = [...firstVideoFormatIds].filter(formatId => {
    return selectedVideos.every(video =>
      video.formats?.some(f => f.format_id === formatId)
    );
  });

  // Return the format objects with aggregated filesize_approx and tbr
  return commonFormatIds.map(formatId => {
    // Get the base format from the first video
    const baseFormat = firstVideoFormats.find(f => f.format_id === formatId)!;

    // Calculate aggregated values across all selected videos
    let totalFilesizeApprox: number | null = null;
    let totalTbr: number | null = null;
    let allHaveFilesize = true;
    let allHaveTbr = true;

    for (const video of selectedVideos) {
      const format = video.formats?.find(f => f.format_id === formatId);
      if (format) {
        if (format.filesize_approx != null) {
          totalFilesizeApprox = (totalFilesizeApprox ?? 0) + format.filesize_approx;
        } else {
          allHaveFilesize = false;
        }

        if (format.tbr != null) {
          totalTbr = (totalTbr ?? 0) + format.tbr;
        } else {
          allHaveTbr = false;
        }
      }
    }

    // Return a new format object with aggregated values
    return {
      ...baseFormat,
      filesize_approx: allHaveFilesize ? totalFilesizeApprox : null,
      tbr: allHaveTbr ? totalTbr : null,
    };
  });
};

export const getMergedBestFormat = (
  entries: RawVideoInfo[],
  selectedIndices: string[]
): VideoFormat | undefined => {
  // If no videos selected, return undefined
  if (!entries || entries.length === 0 || selectedIndices.length === 0) {
    return undefined;
  }

  // Get the selected videos (convert 1-indexed strings to 0-indexed numbers)
  const selectedVideos = selectedIndices
    .map(index => entries[Number(index) - 1])
    .filter(video => video && video.requested_downloads && video.requested_downloads.length > 0);

  if (selectedVideos.length === 0) {
    return undefined;
  }

  // If only one video selected, return its requested_downloads[0]
  if (selectedVideos.length === 1) {
    return selectedVideos[0].requested_downloads[0];
  }

  // Get the base format from the first video
  const baseFormat = selectedVideos[0].requested_downloads[0];

  // Check if all selected videos have the same format_id
  const allSameFormatId = selectedVideos.every(video =>
    video.requested_downloads[0]?.format_id === baseFormat.format_id
  );

  // Calculate aggregated values across all selected videos
  let totalFilesizeApprox: number | null = null;
  let totalTbr: number | null = null;
  let allHaveFilesize = true;
  let allHaveTbr = true;

  for (const video of selectedVideos) {
    const format = video.requested_downloads[0];
    if (format) {
      if (format.filesize_approx != null) {
        totalFilesizeApprox = (totalFilesizeApprox ?? 0) + format.filesize_approx;
      } else {
        allHaveFilesize = false;
      }

      if (format.tbr != null) {
        totalTbr = (totalTbr ?? 0) + format.tbr;
      } else {
        allHaveTbr = false;
      }
    }
  }

  // Return a merged format object with aggregated values
  // If all format_ids are the same, keep original attributes; otherwise use 'auto'
  if (allSameFormatId) {
    return {
      ...baseFormat,
      filesize_approx: allHaveFilesize ? totalFilesizeApprox : null,
      tbr: allHaveTbr ? totalTbr : null,
    };
  } else {
    return {
      ...baseFormat,
      format: 'Best Quality (Auto)',
      format_id: 'best',
      format_note: 'auto',
      ext: 'auto',
      resolution: 'auto',
      dynamic_range: 'auto',
      acodec: 'auto',
      vcodec: 'auto',
      audio_ext: 'auto',
      video_ext: 'auto',
      fps: null,
      filesize_approx: allHaveFilesize ? totalFilesizeApprox : null,
      tbr: allHaveTbr ? totalTbr : null,
    } as VideoFormat;
  }
};

export const getCommonSubtitles = (
  entries: RawVideoInfo[],
  selectedIndices: string[]
): { [subtitle_id: string]: VideoSubtitle[] } => {
  // If no videos selected, return empty object
  if (!entries || entries.length === 0 || selectedIndices.length === 0) {
    return {};
  }

  // Get the selected videos (convert 1-indexed strings to 0-indexed numbers)
  const selectedVideos = selectedIndices
    .map(index => entries[Number(index) - 1])
    .filter(video => video && video.subtitles);

  if (selectedVideos.length === 0) {
    return {};
  }

  // If only one video selected, return all its subtitles
  if (selectedVideos.length === 1) {
    return selectedVideos[0].subtitles || {};
  }

  // Get subtitle keys from the first selected video as the base set
  const firstVideoSubtitles = selectedVideos[0].subtitles || {};
  const firstVideoSubtitleKeys = new Set(Object.keys(firstVideoSubtitles));

  // Find subtitle keys that exist in ALL selected videos
  const commonSubtitleKeys = [...firstVideoSubtitleKeys].filter(subtitleKey => {
    return selectedVideos.every(video =>
      video.subtitles && Object.prototype.hasOwnProperty.call(video.subtitles, subtitleKey)
    );
  });

  // Return subtitle object with only common keys (using first video's subtitle data)
  return Object.fromEntries(
    commonSubtitleKeys.map(key => [key, firstVideoSubtitles[key]])
  );
};

export const getCommonAutoSubtitles = (
  entries: RawVideoInfo[],
  selectedIndices: string[]
): { [subtitle_id: string]: VideoSubtitle[] } => {
  // If no videos selected, return empty object
  if (!entries || entries.length === 0 || selectedIndices.length === 0) {
    return {};
  }

  // Get the selected videos (convert 1-indexed strings to 0-indexed numbers)
  const selectedVideos = selectedIndices
    .map(index => entries[Number(index) - 1])
    .filter(video => video && video.automatic_captions);

  if (selectedVideos.length === 0) {
    return {};
  }

  // If only one video selected, return all its automatic captions
  if (selectedVideos.length === 1) {
    return selectedVideos[0].automatic_captions || {};
  }

  // Get auto subtitle keys from the first selected video as the base set
  const firstVideoAutoSubs = selectedVideos[0].automatic_captions || {};
  const firstVideoAutoSubKeys = new Set(Object.keys(firstVideoAutoSubs));

  // Find auto subtitle keys that exist in ALL selected videos
  const commonAutoSubKeys = [...firstVideoAutoSubKeys].filter(subtitleKey => {
    return selectedVideos.every(video =>
      video.automatic_captions && Object.prototype.hasOwnProperty.call(video.automatic_captions, subtitleKey)
    );
  });

  // Return auto subtitle object with only common keys (using first video's data)
  return Object.fromEntries(
    commonAutoSubKeys.map(key => [key, firstVideoAutoSubs[key]])
  );
};
