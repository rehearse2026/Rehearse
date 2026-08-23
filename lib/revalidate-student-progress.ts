/**
 * revalidate-student-progress.ts
 * Busts cached student surfaces that show Start vs Continue.
 */

import { revalidatePath } from "next/cache";

/**
 * Revalidates class detail, simulations tab, and Tempo entry after attempt progress.
 */
export function revalidateStudentAttemptSurfaces(options: {
  classId?: string | null;
  simulationId?: string | null;
}): void {
  revalidatePath("/student/simulations");
  revalidatePath("/student/classes");
  revalidatePath("/student/dashboard");

  if (options.classId) {
    revalidatePath(`/student/classes/${options.classId}`);
  }

  if (options.simulationId) {
    revalidatePath(`/student/simulation/${options.simulationId}/entry`);
    if (options.classId) {
      revalidatePath(
        `/student/simulation/${options.simulationId}/entry?classId=${options.classId}`
      );
    }
  }
}
