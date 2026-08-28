/**
 * SimulationForm.tsx
 * Two-column create / edit simulation form for teachers (Stitch layout).
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { createClient } from "@/lib/supabase/client";
import type { Simulation } from "@/types";

type SimulationFormProps = {
  teacherId: string;
  initial?: Simulation;
};

/**
 * Teacher form to save a simulation draft.
 */
export function SimulationForm({
  teacherId,
  initial,
}: SimulationFormProps): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [personaName, setPersonaName] = useState(initial?.persona_name ?? "");
  const [personaRole, setPersonaRole] = useState(initial?.persona_role ?? "");
  const [personaPrompt, setPersonaPrompt] = useState(initial?.persona_system_prompt ?? "");
  const [productContext, setProductContext] = useState(initial?.product_context ?? "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async (): Promise<void> => {
    setIsLoading(true);
    setError("");

    if (!title || !personaName || !personaRole || !personaPrompt || !productContext) {
      setError("Please fill in all required fields.");
      setIsLoading(false);
      return;
    }

    const payload = {
      teacher_id: teacherId,
      title,
      description: description || null,
      persona_name: personaName,
      persona_role: personaRole,
      persona_system_prompt: personaPrompt,
      product_context: productContext,
      is_published: initial?.is_published ?? false,
    };

    const supabase = createClient();

    if (initial) {
      const { error: updateError } = await supabase
        .from("simulations")
        .update(payload)
        .eq("id", initial.id);
      if (updateError) {
        setError(updateError.message);
        showToast("Something went wrong. Please try again.", "error");
        setIsLoading(false);
        return;
      }
      showToast("Simulation saved successfully", "success");
      router.push(`/teacher/simulation/${initial.id}/edit`);
    } else {
      const { data, error: insertError } = await supabase
        .from("simulations")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) {
        setError(insertError.message);
        showToast("Something went wrong. Please try again.", "error");
        setIsLoading(false);
        return;
      }
      showToast("Simulation saved successfully", "success");
      router.push(`/teacher/simulation/${data.id}/edit`);
    }
    router.refresh();
    setIsLoading(false);
  };

  return (
    <form className="max-w-5xl" onSubmit={(e) => e.preventDefault()}>
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="card-surface p-6 space-y-4">
            <h2 className="font-semibold text-text-primary text-lg border-b border-border pb-2">
              Basics
            </h2>
            <input
              placeholder="Simulation title"
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Description"
              className="input-field"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </section>

          <section className="card-surface p-6 space-y-4">
            <h2 className="font-semibold text-text-primary text-lg border-b border-border pb-2">
              Persona
            </h2>
            <input
              placeholder="Persona name"
              className="input-field"
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
            />
            <input
              placeholder="Persona role"
              className="input-field"
              value={personaRole}
              onChange={(e) => setPersonaRole(e.target.value)}
            />
            <textarea
              placeholder="Persona system prompt"
              className="input-field"
              rows={8}
              value={personaPrompt}
              onChange={(e) => setPersonaPrompt(e.target.value)}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="card-surface p-6 border-l-4 border-l-gold">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
              Live preview
            </p>
            <h3 className="text-lg font-bold text-text-primary">{title || "Simulation title"}</h3>
            <p className="text-sm text-text-secondary mt-2">
              <span className="font-semibold text-text-primary">{personaName}</span>
              {" · "}
              {personaRole}
            </p>
            <p className="text-sm text-text-secondary mt-3 line-clamp-4">
              {productContext || "Product context will appear here as you type."}
            </p>
            {description.length > 0 && (
              <p className="text-xs text-text-secondary mt-3 pt-3 border-t border-border">
                {description}
              </p>
            )}
          </section>

          <section className="card-surface p-6 space-y-4">
            <h2 className="font-semibold text-text-primary text-lg border-b border-border pb-2">
              Scenario
            </h2>
            <textarea
              placeholder="Product context — what the student is selling"
              className="input-field min-h-[200px]"
              rows={10}
              value={productContext}
              onChange={(e) => setProductContext(e.target.value)}
            />
          </section>

          {error && (
            <p className="text-sm text-error border border-error/30 bg-error/5 rounded-md p-3">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleSave()}
              className="btn-primary"
            >
              {isLoading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
