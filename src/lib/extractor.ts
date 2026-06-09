import JSZip from 'jszip';

export interface ExtractionSettings {
  frameCount: number;
  format: 'jpeg' | 'png' | 'webp';
  quality: number; // 0.1 to 1.0 (for jpeg and webp)
}

export interface ExtractedFrame {
  id: string;
  url: string;
  blob: Blob;
  time: number;
  index: number;
}

const seekToTime = (video: HTMLVideoElement, time: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;

    const handleSeeked = () => {
      clearTimeout(timeout);
      resolve();
    };

    const handleError = (e: Event | string) => {
      clearTimeout(timeout);
      video.removeEventListener('seeked', handleSeeked);
      reject(e);
    };

    timeout = setTimeout(() => {
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      // Fallback: sometimes seeked doesn't fire nicely, just resolve and hope canvas captures it
      resolve();
    }, 2000); // 2 second timeout per seek

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', handleError, { once: true });

    video.currentTime = time;
  });
};

export const extractVideoFrames = async (
  file: File,
  settings: ExtractionSettings,
  onProgress: (progress: number) => void
): Promise<ExtractedFrame[]> => {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    // required for some mobile browsers to process video in background
    video.setAttribute('playsinline', 'true');
    video.crossOrigin = 'anonymous';

    // Wait for metadata to know the duration and dimensions
    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!duration || !isFinite(duration)) {
        URL.revokeObjectURL(videoUrl);
        return reject(new Error('Invalid video duration.'));
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(videoUrl);
        return reject(new Error('Canvas 2D context not available.'));
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const frames: ExtractedFrame[] = [];
      const { frameCount, format, quality } = settings;
      
      const interval = duration / frameCount;

      for (let i = 0; i < frameCount; i++) {
        // Calculate time, use midpoint of the interval to avoid edge black frames
        const time = Math.min((i * interval) + (interval / 2), duration - 0.05);

        try {
          await seekToTime(video, time);
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const mimeType = `image/${format}`;
          
          // Helper to get blob
          const blob = await new Promise<Blob>((res, rej) => {
            canvas.toBlob(
              (b) => {
                if (b) res(b);
                else rej(new Error('Blob conversion failed'));
              },
              mimeType,
              quality
            );
          });
          const url = URL.createObjectURL(blob);

          frames.push({
            id: `frame-${i}-${Date.now()}`,
            url,
            blob,
            time,
            index: i + 1,
          });

          onProgress(((i + 1) / frameCount) * 100);
        } catch (error) {
          console.error(`Error extracting frame at ${time}s:`, error);
        }
      }

      URL.revokeObjectURL(videoUrl);
      resolve(frames);
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Failed to load video file.'));
    };
  });
};

export const downloadFramesAsZip = async (
  frames: ExtractedFrame[],
  format: string,
  onProgress?: (progress: number) => void
) => {
  const zip = new JSZip();

  frames.forEach((frame) => {
    // Determine extension
    let ext = format === 'jpeg' ? 'jpg' : format;
    const filename = `frame_${String(frame.index).padStart(4, '0')}.${ext}`;
    zip.file(filename, frame.blob);
  });

  const content = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 5
    }
  }, (metadata) => {
    if (onProgress) {
      onProgress(metadata.percent);
    }
  });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `extracted_frames_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 200);
};

export const exportFramesToPdf = async (
  frames: ExtractedFrame[],
  onProgress?: (progress: number) => void
) => {
  const { jsPDF } = await import('jspdf');
  
  // We'll create a PDF where each frame is on its own page
  // Optimized for the video's aspect ratio if possible
  const firstFrame = new Image();
  await new Promise((resolve, reject) => {
    firstFrame.onload = resolve;
    firstFrame.onerror = reject;
    firstFrame.src = frames[0].url;
  });

  const orientation = firstFrame.width > firstFrame.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [firstFrame.width, firstFrame.height]
  });

  for (let i = 0; i < frames.length; i++) {
    if (i > 0) {
      pdf.addPage([firstFrame.width, firstFrame.height], orientation);
    }
    
    let targetImg = firstFrame;
    if (i > 0) {
      targetImg = new Image();
      await new Promise((resolve, reject) => {
        targetImg.onload = resolve;
        targetImg.onerror = reject;
        targetImg.src = frames[i].url;
      });
    }
    
    const imageFormat = frames[i].blob.type === 'image/png' ? 'PNG' : 'JPEG';
    pdf.addImage(targetImg, imageFormat, 0, 0, firstFrame.width, firstFrame.height);
    
    if (onProgress) {
      onProgress(((i + 1) / frames.length) * 100);
    }
  }

  pdf.save(`extracted_frames_${Date.now()}.pdf`);
};
