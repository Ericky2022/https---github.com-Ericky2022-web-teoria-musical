import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
} from "firebase/firestore";
import { firebaseApp } from "../firebase.config";

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

interface StudentSummary {
  student: string;
  attempts: number;
  avgPercent: number;
  bestPercent: number;
  totalCorrect: number;
  totalQuestions: number;
  lastRecordAt: number;
}

@Component({
  selector: "app-dev-general-report",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./dev-general-report.component.html",
  styleUrl: "./dev-general-report.component.css",
})
export class DevGeneralReportComponent implements OnInit {
  records: PerformanceRecord[] = [];
  isLoading = false;
  errorMessage = "";
  expandedStudent = "";

  private readonly firestoreDb = getFirestore(firebaseApp);

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = "";

    try {
      const recordsQuery = query(
        collection(this.firestoreDb, "results"),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(recordsQuery);

      this.records = snapshot.docs.map((item) => {
        const data = item.data() as PerformanceRecord;
        return {
          timestamp: data.timestamp ?? "",
          student: data.student ?? "",
          level: data.level ?? "",
          phase: data.phase ?? 0,
          score: data.score ?? 0,
          totalQuestions: data.totalQuestions ?? 0,
          percent: data.percent ?? 0,
          createdAt: data.createdAt,
        };
      });
    } catch {
      this.records = [];
      this.errorMessage =
        "Nao foi possivel carregar o relatorio geral do Firestore.";
    } finally {
      this.isLoading = false;
    }
  }

  get totalStudents(): number {
    return new Set(
      this.records.map((item) => item.student.trim()).filter(Boolean),
    ).size;
  }

  get totalAttempts(): number {
    return this.records.length;
  }

  get studentSummaries(): StudentSummary[] {
    const grouped = new Map<string, StudentSummary>();

    for (const record of this.records) {
      const student = record.student.trim() || "Sem nome";
      const current = grouped.get(student);
      const createdAt = record.createdAt ?? 0;

      if (!current) {
        grouped.set(student, {
          student,
          attempts: 1,
          avgPercent: record.percent,
          bestPercent: record.percent,
          totalCorrect: record.score,
          totalQuestions: record.totalQuestions,
          lastRecordAt: createdAt,
        });
        continue;
      }

      current.attempts += 1;
      current.totalCorrect += record.score;
      current.totalQuestions += record.totalQuestions;
      current.bestPercent = Math.max(current.bestPercent, record.percent);
      current.lastRecordAt = Math.max(current.lastRecordAt, createdAt);
      current.avgPercent =
        (current.avgPercent * (current.attempts - 1) + record.percent) /
        current.attempts;
    }

    return Array.from(grouped.values()).sort(
      (a, b) => b.lastRecordAt - a.lastRecordAt,
    );
  }

  toggleStudentDetails(student: string): void {
    this.expandedStudent = this.expandedStudent === student ? "" : student;
  }

  isStudentExpanded(student: string): boolean {
    return this.expandedStudent === student;
  }

  attemptsByStudent(student: string): PerformanceRecord[] {
    return this.records
      .filter((item) => (item.student.trim() || "Sem nome") === student)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }
}
