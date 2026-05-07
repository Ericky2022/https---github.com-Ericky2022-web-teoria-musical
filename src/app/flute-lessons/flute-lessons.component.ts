import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";

interface FluteLesson {
  number: number;
  title: string;
  sourceType: "local" | "youtube";
  videoSrc: string;
  captionSrc?: string;
  scoreImageSrc?: string;
}

interface FluteLessonAccessEvent {
  lessonNumber: number;
  lessonTitle: string;
  sourceType: "local" | "youtube";
}

@Component({
  selector: "app-flute-lessons",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./flute-lessons.component.html",
  styleUrl: "./flute-lessons.component.css",
})
export class FluteLessonsComponent {
  @Output() back = new EventEmitter<void>();
  @Output() lessonAccess = new EventEmitter<FluteLessonAccessEvent>();

  scoreImageLoadFailed = false;

  constructor(private readonly sanitizer: DomSanitizer) {}

  readonly lessons: FluteLesson[] = Array.from({ length: 32 }, (_, i) => {
    const lessonNumber = i + 1;

    if (lessonNumber === 1) {
      return {
        number: lessonNumber,
        title: `Aula ${lessonNumber}`,
        sourceType: "youtube",
        videoSrc: "https://youtu.be/ffCBSKwBMck",
        scoreImageSrc: `/assets/partituras/aula${lessonNumber}.png`,
      };
    }

    if (lessonNumber === 2) {
      return {
        number: lessonNumber,
        title: `Aula ${lessonNumber}`,
        sourceType: "youtube",
        videoSrc: "https://youtu.be/5WzvtE1QeAY",
        scoreImageSrc: `/assets/partituras/aula${lessonNumber}.png`,
      };
    }

    return {
      number: lessonNumber,
      title: `Aula ${lessonNumber}`,
      sourceType: "local",
      videoSrc: `assets/videos/aula${lessonNumber}.mp4`,
      captionSrc: "data:text/vtt;charset=utf-8,WEBVTT",
      scoreImageSrc: `/assets/partituras/aula${lessonNumber}.png`,
    };
  });

  selectedLesson: FluteLesson | null = null;

  get selectedLessonEmbedUrl(): SafeResourceUrl | null {
    if (this.selectedLesson?.sourceType !== "youtube") {
      return null;
    }

    const videoId = this.extractYoutubeVideoId(this.selectedLesson.videoSrc);

    if (!videoId) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`,
    );
  }

  openLesson(lesson: FluteLesson): void {
    this.scoreImageLoadFailed = false;
    this.selectedLesson = lesson;
    this.lessonAccess.emit({
      lessonNumber: lesson.number,
      lessonTitle: lesson.title,
      sourceType: lesson.sourceType,
    });
  }

  closeLesson(): void {
    this.selectedLesson = null;
  }

  goBack(): void {
    this.closeLesson();
    this.back.emit();
  }

  handleScoreImageError(): void {
    this.scoreImageLoadFailed = true;
  }

  private extractYoutubeVideoId(url: string): string | null {
    const shortMatch = /youtu\.be\/([^?&/]+)/i.exec(url);

    if (shortMatch?.[1]) {
      return shortMatch[1];
    }

    const embedMatch = /youtube\.com\/embed\/([^?&/]+)/i.exec(url);

    if (embedMatch?.[1]) {
      return embedMatch[1];
    }

    const watchMatch = /[?&]v=([^?&/]+)/i.exec(url);

    return watchMatch?.[1] ?? null;
  }
}
