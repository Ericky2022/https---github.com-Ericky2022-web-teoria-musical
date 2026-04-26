import { CommonModule } from "@angular/common";
import { Component, ElementRef, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
} from "firebase/firestore";
import { firebaseApp } from "./firebase.config";

type Screen = "home" | "phases" | "exercise" | "report";

interface MusicNote {
  displayName: string;
  audioKey: string;
  duration: number;
  staffStep: number;
  rhythmLabel: string;
}

interface StageConfig {
  level: "easy" | "medium" | "hard";
  duration: number;
  phase: number;
}

interface LevelConfig {
  title: string;
  durationLabel: string;
  accentColor: string;
  stageStart: number;
  phases: string[];
}

interface ResultState {
  title: string;
  content: string;
  isBad: boolean;
  isGood: boolean;
  isLast: boolean;
}

interface PerformanceRecord {
  timestamp: string;
  student: string;
  level: string;
  phase: number;
  score: number;
  totalQuestions: number;
  percent: number;
  createdAt?: number;
}

const firestoreDb = getFirestore(firebaseApp);

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  @ViewChild("staffCanvas") staffCanvas?: ElementRef<HTMLCanvasElement>;

  readonly options = ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"];
  readonly totalQuestions = 20;
  readonly goodPercent = 75;
  readonly excellentPercent = 85;

  readonly stages: StageConfig[] = [
    { level: "easy", duration: 4, phase: 1 },
    { level: "easy", duration: 4, phase: 2 },
    { level: "easy", duration: 4, phase: 3 },
    { level: "easy", duration: 4, phase: 4 },
    { level: "medium", duration: 2, phase: 1 },
    { level: "medium", duration: 2, phase: 2 },
    { level: "medium", duration: 2, phase: 3 },
    { level: "medium", duration: 2, phase: 4 },
    { level: "hard", duration: 1, phase: 1 },
    { level: "hard", duration: 1, phase: 2 },
    { level: "hard", duration: 1, phase: 3 },
    { level: "hard", duration: 1, phase: 4 },
  ];

  readonly levels: LevelConfig[] = [
    {
      title: "Inicial",
      durationLabel: "4 tempos",
      accentColor: "#005f73",
      stageStart: 0,
      phases: [
        "Notas de Dó a Sol (4 tempos)",
        "Notas de Dó a Dó (4 tempos)",
        "Dó a Sol da segunda oitava (4 tempos)",
        "Dó da 1ª oitava até Sol da 2ª oitava (4 tempos)",
      ],
    },
    {
      title: "Intermediário",
      durationLabel: "2 tempos",
      accentColor: "#0a9396",
      stageStart: 4,
      phases: [
        "Notas de Dó a Sol (2 tempos)",
        "Notas de Dó a Dó (2 tempos)",
        "Dó a Sol da segunda oitava (2 tempos)",
        "Dó da 1ª oitava até Sol da 2ª oitava (2 tempos)",
      ],
    },
    {
      title: "Avançado",
      durationLabel: "1 tempo",
      accentColor: "#9b2226",
      stageStart: 8,
      phases: [
        "Notas de Dó a Sol (1 tempo)",
        "Notas de Dó a Dó (1 tempo)",
        "Dó a Sol da segunda oitava (1 tempo)",
        "Dó da 1ª oitava até Sol da 2ª oitava (1 tempo)",
      ],
    },
  ];

  screen: Screen = "home";
  playerNameInput = "";
  playerName = "";
  showOptions = false;

  selectedLevelIndex = 0;

  stageIndex = 0;
  notes: MusicNote[] = [];
  currentNote?: MusicNote;
  currentQuestion = 1;
  score = 0;
  counter = 0;
  isAnswered = false;

  feedback = "";
  feedbackCorrect = false;

  modalVisible = false;
  resultState?: ResultState;
  performanceRecordsData: PerformanceRecord[] = [];
  isReportLoading = false;
  reportError = "";

  private readonly noteAudioPaths: Record<string, string> = {
    C1: "assets/audio/C1.MP3",
    D1: "assets/audio/D1.MP3",
    E1: "assets/audio/E1.MP3",
    F1: "assets/audio/F1.MP3",
    G1: "assets/audio/G1.MP3",
    A1: "assets/audio/A1.MP3",
    B1: "assets/audio/B1.MP3",
    C2: "assets/audio/C2.MP3",
    D2: "assets/audio/D2.MP3",
    E2: "assets/audio/E2.MP3",
    F2: "assets/audio/F2.MP3",
    G2: "assets/audio/G2.MP3",
  };

  private readonly errorAudioPath = "assets/audio/error.mp3";
  private readonly countdownAudioPath = "assets/audio/contagem.wav";

  private readonly audioCache = new Map<string, HTMLAudioElement>();

  private timerId?: ReturnType<typeof setTimeout>;

  get stage(): StageConfig {
    return this.stages[this.stageIndex];
  }

  get levelPhaseLabel(): string {
    return `${this.levelLabel(this.stage.level)} - Fase ${this.stage.phase}`;
  }

  get counterPercent(): number {
    return Math.max(
      0,
      Math.min(100, (this.counter / this.stage.duration) * 100),
    );
  }

  get performanceCount(): number {
    return this.performanceRecordsData.length;
  }

  get performanceRecords(): PerformanceRecord[] {
    return [...this.performanceRecordsData].reverse();
  }

  get averagePercent(): number {
    const records = this.performanceRecordsData;
    if (records.length === 0) {
      return 0;
    }

    const total = records.reduce((sum, record) => sum + record.percent, 0);
    return total / records.length;
  }

  startTraining(): void {
    const name = this.playerNameInput.trim();
    if (!name) {
      alert("Digite seu nome para começar.");
      return;
    }
    this.playerName = name;
    this.showOptions = true;
    void this.refreshPerformanceRecords();
  }

  openPhases(levelIdx: number): void {
    this.selectedLevelIndex = levelIdx;
    this.screen = "phases";
  }

  openReport(): void {
    this.clearTimer();
    this.modalVisible = false;
    this.screen = "report";
    void this.refreshPerformanceRecords();
  }

  goHome(): void {
    this.clearTimer();
    this.modalVisible = false;
    this.screen = "home";
  }

  startExercise(stageIndex: number): void {
    this.clearTimer();
    this.modalVisible = false;
    this.stageIndex = stageIndex;
    this.notes = this.getNotesByPhase(this.stage.phase, this.stage.duration);
    this.currentQuestion = 1;
    this.score = 0;
    this.isAnswered = false;
    this.feedback = "";
    this.counter = 0;
    this.screen = "exercise";
    this.generateQuestion();
  }

  checkAnswer(selected: string): void {
    if (this.isAnswered || !this.currentNote) {
      return;
    }

    this.clearTimer();
    this.isAnswered = true;

    const correct = selected === this.currentNote.displayName;
    if (correct) {
      this.score++;
      this.playNoteAudio(this.currentNote.audioKey);
    } else {
      this.playAudio(this.errorAudioPath);
    }

    this.feedbackCorrect = correct;
    this.feedback = correct
      ? "Acertou!"
      : `Errou! Resposta correta: ${this.currentNote.displayName}`;

    setTimeout(() => this.moveToNext(), 1000);
  }

  closeModalToPhases(): void {
    this.modalVisible = false;
    this.screen = "phases";
  }

  retryCurrent(): void {
    this.modalVisible = false;
    this.startExercise(this.stageIndex);
  }

  clearPerformanceData(): void {
    if (!confirm("Deseja apagar todo o histórico salvo?")) {
      return;
    }

    void this.clearFirestoreRecords();
  }

  private async clearFirestoreRecords(): Promise<void> {
    try {
      const snapshot = await getDocs(collection(firestoreDb, "results"));
      await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));

      this.performanceRecordsData = [];
      this.reportError = "";
    } catch {
      this.reportError = "Nao foi possivel limpar o historico no Firestore.";
    }
  }

  mainModalAction(): void {
    if (!this.resultState) {
      return;
    }

    this.modalVisible = false;

    if (this.resultState.isBad) {
      this.startExercise(this.stageIndex);
      return;
    }

    if (this.resultState.isLast) {
      this.goHome();
      return;
    }

    this.startExercise(this.stageIndex + 1);
  }

  private generateQuestion(): void {
    const previousName = this.currentNote?.displayName;
    let next = this.notes[Math.floor(Math.random() * this.notes.length)];

    if (this.notes.length > 1 && previousName) {
      let guard = 0;
      while (next.displayName === previousName && guard < 20) {
        next = this.notes[Math.floor(Math.random() * this.notes.length)];
        guard++;
      }
    }

    this.currentNote = next;
    this.isAnswered = false;
    this.feedback = "";
    this.counter = 0;

    setTimeout(() => this.drawStaff(), 0);
    this.startTimer();
  }

  private startTimer(): void {
    this.clearTimer();

    const tick = () => {
      if (this.isAnswered) {
        this.clearTimer();
        return;
      }

      if (this.counter >= this.stage.duration) {
        this.clearTimer();
        this.handleTimeout();
        return;
      }

      this.counter++;
      this.playAudio(
        this.countdownAudioPath,
        this.getCountdownVolume(this.counter, this.stage.duration),
      );
      this.timerId = setTimeout(tick, 1000);
    };

    this.timerId = setTimeout(tick, 1000);
  }

  private handleTimeout(): void {
    if (this.isAnswered || !this.currentNote) {
      return;
    }

    this.isAnswered = true;
    this.feedbackCorrect = false;
    this.feedback = `Tempo esgotado! Resposta correta: ${this.currentNote.displayName}`;
    this.playAudio(this.errorAudioPath);

    setTimeout(() => this.moveToNext(), 1000);
  }

  private moveToNext(): void {
    if (this.currentQuestion >= this.totalQuestions) {
      this.showResult();
      return;
    }

    this.currentQuestion++;
    this.generateQuestion();
  }

  private showResult(): void {
    this.clearTimer();

    const percent = (this.score / this.totalQuestions) * 100;
    const isBad = percent < this.goodPercent;
    const isGood =
      percent >= this.goodPercent && percent < this.excellentPercent;
    const isLast = this.stageIndex >= this.stages.length - 1;

    let statusText =
      "Parabéns! Você está indo muito bem, pode prosseguir para o próximo nível.";
    if (isBad) {
      statusText = "Recomendo você continuar estudando.";
    } else if (isGood) {
      statusText =
        "Muito bom! Você pode tentar novamente ou prosseguir para o próximo exercício.";
    }

    this.resultState = {
      title: isBad ? "Continue praticando" : "Resultado da fase",
      content:
        `Aluno: ${this.playerName}\n` +
        `${this.levelLabel(this.stage.level)} - Fase ${this.stage.phase}\n` +
        `Acertos: ${this.score} de ${this.totalQuestions}\n` +
        `Percentual de acerto: ${percent.toFixed(1)}%\n\n` +
        statusText,
      isBad,
      isGood,
      isLast,
    };

    void this.savePerformanceRecord({
      timestamp: new Date().toLocaleString("pt-BR"),
      student: this.playerName,
      level: this.levelLabel(this.stage.level),
      phase: this.stage.phase,
      score: this.score,
      totalQuestions: this.totalQuestions,
      percent,
    });

    this.modalVisible = true;
  }

  private levelLabel(level: "easy" | "medium" | "hard"): string {
    if (level === "easy") {
      return "Inicial";
    }
    if (level === "medium") {
      return "Intermediário";
    }
    return "Avançado";
  }

  private getNotesByPhase(phase: number, duration: number): MusicNote[] {
    const note = (
      displayName: string,
      audioKey: string,
      staffStep: number,
    ): MusicNote => ({
      displayName,
      audioKey,
      duration,
      staffStep,
      rhythmLabel: this.rhythmLabel(duration),
    });

    switch (phase) {
      case 1:
        return [
          note("Dó", "C1", -2),
          note("Ré", "D1", -1),
          note("Mi", "E1", 0),
          note("Fá", "F1", 1),
          note("Sol", "G1", 2),
        ];
      case 2:
        return [
          note("Dó", "C1", -2),
          note("Ré", "D1", -1),
          note("Mi", "E1", 0),
          note("Fá", "F1", 1),
          note("Sol", "G1", 2),
          note("Lá", "A1", 3),
          note("Si", "B1", 4),
          note("Dó", "C2", 5),
        ];
      case 3:
        return [
          note("Dó", "C2", 5),
          note("Ré", "D2", 6),
          note("Mi", "E2", 7),
          note("Fá", "F2", 8),
          note("Sol", "G2", 9),
        ];
      case 4:
        return [
          note("Dó", "C1", -2),
          note("Ré", "D1", -1),
          note("Mi", "E1", 0),
          note("Fá", "F1", 1),
          note("Sol", "G1", 2),
          note("Lá", "A1", 3),
          note("Si", "B1", 4),
          note("Dó", "C2", 5),
          note("Ré", "D2", 6),
          note("Mi", "E2", 7),
          note("Fá", "F2", 8),
          note("Sol", "G2", 9),
        ];
      default:
        return [];
    }
  }

  private rhythmLabel(duration: number): string {
    if (duration === 4) {
      return "Semibreve (4 tempos)";
    }
    if (duration === 2) {
      return "Mínima (2 tempos)";
    }
    return "Semínima (1 tempo)";
  }

  private clearTimer(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }

    this.stopAudio(this.countdownAudioPath);
  }

  private playNoteAudio(audioKey: string): void {
    const audioPath = this.noteAudioPaths[audioKey];
    if (!audioPath) {
      return;
    }
    this.playAudio(audioPath);
  }

  private playAudio(audioPath: string, volume = 1): void {
    const resolvedAudioPath = this.resolveAssetUrl(audioPath);
    let audio = this.audioCache.get(resolvedAudioPath);

    if (!audio) {
      audio = new Audio(resolvedAudioPath);
      audio.preload = "auto";
      this.audioCache.set(resolvedAudioPath, audio);
    }

    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Ignora falhas de autoplay para não quebrar o fluxo do exercício.
    });
  }

  private stopAudio(audioPath: string): void {
    const resolvedAudioPath = this.resolveAssetUrl(audioPath);
    const audio = this.audioCache.get(resolvedAudioPath);
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }

  private resolveAssetUrl(relativePath: string): string {
    return new URL(relativePath, document.baseURI).toString();
  }

  private getCountdownVolume(currentTick: number, totalTicks: number): number {
    if (totalTicks <= 1) {
      return 1;
    }

    const minVolume = 0.25;
    const progress = (currentTick - 1) / (totalTicks - 1);
    return minVolume + (1 - minVolume) * progress;
  }

  private async savePerformanceRecord(
    record: PerformanceRecord,
  ): Promise<void> {
    try {
      await addDoc(collection(firestoreDb, "results"), {
        ...record,
        createdAt: Date.now(),
      });
      await this.refreshPerformanceRecords();
    } catch {
      this.reportError = "Nao foi possivel salvar o resultado no Firestore.";
    }
  }

  private async refreshPerformanceRecords(): Promise<void> {
    this.isReportLoading = true;
    this.reportError = "";

    try {
      const recordsQuery = query(
        collection(firestoreDb, "results"),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(recordsQuery);

      this.performanceRecordsData = snapshot.docs.map((item) => {
        const data = item.data() as PerformanceRecord;
        return {
          timestamp: data.timestamp ?? "",
          student: data.student ?? "",
          level: data.level ?? "",
          phase: data.phase ?? 0,
          score: data.score ?? 0,
          totalQuestions: data.totalQuestions ?? this.totalQuestions,
          percent: data.percent ?? 0,
          createdAt: data.createdAt,
        };
      });
    } catch {
      this.performanceRecordsData = [];
      this.reportError = "Nao foi possivel carregar o relatorio do Firestore.";
    } finally {
      this.isReportLoading = false;
    }
  }

  private drawStaff(): void {
    const canvas = this.staffCanvas?.nativeElement;
    const note = this.currentNote;
    if (!canvas || !note) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const width = canvas.width;
    const left = 24;
    const right = width - 24;
    const top = 55;
    const spacing = 22;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = top + i * spacing;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#0d1b2a";
    ctx.font = "152px serif";
    const gLineY = top + 3 * spacing;
    ctx.fillText("𝄞", left - 8, gLineY + 30);

    const noteX = width * 0.56;
    const bottomLineY = top + 4 * spacing;
    const noteY = bottomLineY - note.staffStep * (spacing / 2);

    const topLineY = top;
    if (noteY < topLineY - 1) {
      let y = topLineY - spacing;
      while (y >= noteY - 1) {
        ctx.beginPath();
        ctx.moveTo(noteX - 22, y);
        ctx.lineTo(noteX + 22, y);
        ctx.stroke();
        y -= spacing;
      }
    }

    if (noteY > bottomLineY + 1) {
      let y = bottomLineY + spacing;
      while (y <= noteY + 1) {
        ctx.beginPath();
        ctx.moveTo(noteX - 22, y);
        ctx.lineTo(noteX + 22, y);
        ctx.stroke();
        y += spacing;
      }
    }

    ctx.save();
    ctx.translate(noteX, noteY);
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#111";
    ctx.lineWidth = 2;

    if (note.duration === 4) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.rotate(-0.22);
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
      if (note.duration === 2) {
        ctx.stroke();
      } else {
        ctx.fill();
      }
    }
    ctx.restore();

    if (note.duration === 2 || note.duration === 1) {
      ctx.beginPath();
      ctx.moveTo(noteX + 15, noteY - 1);
      ctx.lineTo(noteX + 15, noteY - 60);
      ctx.stroke();
    }
  }
}
