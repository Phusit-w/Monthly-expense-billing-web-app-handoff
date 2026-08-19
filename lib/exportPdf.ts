// One-click "ดาวน์โหลด PDF" (BillEditor's toolbar) — renders each ".paper"
// element inside a container to a raster image (html2canvas) and stacks
// them into a single downloadable PDF (jspdf), one image per physical page.
// This is a separate path from "พิมพ์ / PDF" (EditorToolbar's existing
// button, window.print()): that one still opens the browser's native print
// dialog, where "Save as PDF" is just one of several destinations the user
// has to pick; this generates and downloads the .pdf file directly, no
// dialog. Both libraries are dynamically imported so their (sizeable) JS
// only loads for someone who actually clicks the button.
export interface PdfPageSize {
  widthPx: number;
  heightPx: number;
}

// FA017Form/FA018Form's Name/Office/Date/Description/amount/etc. cells are
// all live <input>/<select> controls (still editable up to the moment of
// export — see BillEditor.tsx), not static text. html2canvas renders a
// snapshot of computed styles/layout, not a real browser paint of form
// controls, so it doesn't reliably draw an <input>'s current value or a
// <select>'s chosen option — depending on the field, that showed up as the
// typed text (and the row's day/month/year — see FA017Form.tsx's DATE
// column comment on why those are plain <input>s, not a native date
// picker) missing entirely, with just the table's own grid lines left
// visible over the empty cell ("โดนเส้นทับหาย"). Swapping every control for
// a plain text node with the same value, right before the capture, sidesteps
// the whole problem — this only touches html2canvas's throwaway cloned
// document (see onclone below), never the live editable page.
function replaceFormControlsWithText(root: HTMLElement) {
  const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input, select, textarea"
  );
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  controls.forEach((el) => {
    const text =
      el instanceof HTMLSelectElement
        ? (el.options[el.selectedIndex]?.text ?? "")
        : el.value;
    const span = doc.createElement("span");
    span.textContent = text;
    span.style.display = "inline-block";
    span.style.boxSizing = "border-box";
    // FA017's header "DATE :" day/month/year controls (.date-field, see
    // globals.css) sit in a tight flex row inside a ~87px-wide cell, each
    // sized to a small fixed px width on purpose. Forcing width:100% +
    // pre-wrap/break-word here (the default below, meant for full-width
    // <input>s like Name/Employee No) made each short number/select claim
    // 100% of that already-narrow flex slot, so the day/month/year digits
    // got squeezed and word-break split them onto a second line inside the
    // cell ("ตัวเลข Date: ตกไปอีกบรรทัด"). Keep these at their natural
    // (shrink-to-fit) width and never wrap instead.
    if (el.classList.contains("date-field")) {
      span.style.width = "auto";
      span.style.whiteSpace = "nowrap";
      // flex-shrink:0 stops html2canvas's flexbox pass from shrinking this
      // span below its content width; white-space:nowrap on the *parent*
      // (not just this span) is extra insurance against "ตัวเลข Date: ตกไป
      // อีกบรรทัด" — html2canvas doesn't fully support flexbox/gap the way
      // a real browser does, so in edge cases it can fall back to treating
      // the flex row as plain inline content and line-wrap the
      // day/slash/month/slash/year sequence when it doesn't fit, even
      // though flex-wrap defaults to nowrap in every real browser (where
      // this always rendered fine — that's why the bug never showed up
      // while editing on screen).
      span.style.flexShrink = "0";
      const parent = el.parentElement;
      if (parent) parent.style.whiteSpace = "nowrap";
    } else {
      span.style.width = "100%";
      span.style.whiteSpace = "pre-wrap";
      span.style.wordBreak = "break-word";
    }
    // Carry over the handful of computed styles that actually affect how
    // the text looks/sits in its cell — everything else about the input's
    // own chrome (border, background, spin arrows) is exactly what we don't
    // want copied, since the plain form fields already render borderless
    // on screen (see e.g. EntryFormFA017's inputStyle) and the boxed ones
    // (.no-spin/.date-field number inputs) are meant to look like plain
    // printed text here too, matching @media print's own .date-field
    // override (globals.css) for the same fields.
    const computed = view?.getComputedStyle(el);
    if (computed) {
      span.style.font = computed.font;
      span.style.color = computed.color;
      span.style.textAlign = computed.textAlign;
      span.style.lineHeight = computed.lineHeight;
    }
    el.replaceWith(span);
  });
}

export async function exportPagesToPdf(
  container: HTMLElement,
  filename: string,
  { widthPx, heightPx }: PdfPageSize
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // One ".paper" per physical A4 page — see FA017Form/FA018Form's
  // renderPage/effectivePages (lib/pagination.ts drives how many get
  // rendered). widthPx/heightPx (PAPER_WIDTH_FA017/018 x
  // PAGE_HEIGHT_BUDGET_FA017/018, lib/constants.ts) are the full physical
  // A4 page size, used below as the PDF page size — but NOT as the image
  // size: .paper's own CSS only fixes its *width* to that full page width,
  // its height is "auto" (content-driven, however tall the rows/header/
  // certification block actually are), pinned to the budget only as an
  // upper bound the pagination math (lib/pagination.ts) keeps content
  // under, not a height it stretches short content up to fill. Forcing
  // every screenshot into a fixed widthPx x heightPx box regardless of its
  // real captured size — the first version of this function did — visibly
  // distorted (squeezed/stretched) any page shorter than a full one, which
  // is the common case (most claims don't fill every row).
  const pages = Array.from(container.querySelectorAll<HTMLElement>(".paper"));
  if (pages.length === 0) return;

  const orientation = widthPx >= heightPx ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [widthPx, heightPx] });

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage([widthPx, heightPx], orientation);
    // scale: 2 for a sharper export than a 1:1 CSS-pixel screenshot would
    // give (screen is ~96dpi; this roughly doubles it). backgroundColor
    // pins it to white regardless of what's behind .paper on screen (the
    // page-shell's gray backdrop — see globals.css's print override for the
    // same concern on the browser print path). ignoreElements skips the
    // same editing-only controls (save/reuse buttons, saved-item pickers)
    // the browser's own @media print already hides via .no-print
    // (globals.css) — this is the PDF path's equivalent of that. onclone
    // swaps every remaining live form control for plain text (see
    // replaceFormControlsWithText's doc comment for why that's needed).
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      ignoreElements: (el) => el.classList.contains("no-print"),
      onclone: (_doc, cloned) => replaceFormControlsWithText(cloned),
    });
    // Draw at .paper's own true aspect ratio (full page width, height
    // scaled proportionally from the actual capture) instead of stretching
    // to fill heightPx — same undistorted look "พิมพ์ / PDF" already gives,
    // where content that doesn't reach the bottom of the page just leaves
    // blank space there rather than being stretched to reach it.
    const imgHeightPx = (canvas.height / canvas.width) * widthPx;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthPx, imgHeightPx);
  }

  pdf.save(filename);
}
