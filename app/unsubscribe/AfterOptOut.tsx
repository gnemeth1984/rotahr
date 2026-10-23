import Link from "next/link";

/**
 * The only marketing on this page, and it renders only after the opt-out has
 * already been written — the confirm button's `done` state, and the branch a
 * returning visitor lands on.
 *
 * (The optional "why are you leaving?" question in UnsubscribeFeedback follows
 * the same rule: it only renders after the opt-out is written.)
 *
 * Two rules it must keep. Nothing here can gate on an email address, because
 * asking for the address of the person who just removed theirs is how an
 * unsubscribe page earns a spam report. And nothing here can read as a step
 * between the reader and being off the list: the opt-out is finished before a
 * word of this is on screen, and the undo sits above it, not below.
 *
 * Counts are real. The template count comes from lib/templates (passed in by
 * the server page); 13 courses in lib/training/courses.ts — if that list
 * changes, change the number here. Never add a customer count, a revenue figure or a "trusted by"
 * line, and never let the training paragraph lose its last sentence.
 */
export function AfterOptOut({ templateCount }: { templateCount: number }) {
  return (
    <div className="mt-6 pt-5 border-t border-white/10">
      <p className="text-[11px] uppercase tracking-wider text-white/35 mb-3">
        Before you go — two things that cost nothing
      </p>

      <p className="text-sm text-white/60 leading-relaxed">
        <span className="text-white/85 font-medium">{templateCount} free templates.</span> Fridge and freezer
        temperature logs, cleaning and opening and closing checklists, rota planners, stocktakes,
        takings and tips sheets, guest incident logs. Each one comes as a printable PDF, an
        editable Excel sheet and a CSV. The download asks for an email address, but yours stays
        unsubscribed — downloading won&apos;t put you back on the list.{" "}
        <Link href="/templates" className="text-[#FF6B35] hover:underline">
          Browse all {templateCount}
        </Link>
        .
      </p>

      <p className="text-sm text-white/60 leading-relaxed mt-4">
        <span className="text-white/85 font-medium">Thirteen in-house staff courses.</span> These
        need an account, but they&apos;re the reason people keep one: each course is built from
        your own venue&apos;s records instead of a generic slideshow — allergens read off your
        menu, fire safety off your equipment register, manual handling off your stock list,
        cleaning off the checks your team actually logged. There is an 80% pass mark, a 12-month
        expiry and a printable completion record for each person. Included on Pro and Enterprise.{" "}
        <Link href="/features" className="text-[#FF6B35] hover:underline">
          How they work
        </Link>
        .
      </p>

      <p className="text-xs text-white/35 leading-relaxed mt-3">
        Those courses are employer-delivered in-house training. They are not accredited
        qualifications and do not replace HACCP Level 2, statutory food safety certification or any
        licensed training.
      </p>
    </div>
  );
}
