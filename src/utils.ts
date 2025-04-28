import { RoutesObj } from "@/types/route";
import { AllRoutes } from "@/routes";
import { DownloadProgress } from "@/types/download";
import { VideoFormat } from "@/types/video";
import * as fs from "@tauri-apps/plugin-fs";

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

export const parseProgressLine = (line: string): DownloadProgress => {
  const progress: Partial<DownloadProgress> = {
    status: 'downloading'
  };

  line.split(',').forEach(pair => {
    const [key, value] = pair.split(':');
    switch (key) {
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
        progress.eta = parseInt(value, 10);
        break;
    }
  });

  return progress as DownloadProgress;
};

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
    return ['none', 'n/a', '-', ''].includes(str);
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