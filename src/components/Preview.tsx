interface PreviewProps {
  /** Raw editor HTML, passed to the iframe verbatim. */
  html: string
}

/**
 * Renders the template inside a sandboxed iframe.
 *
 * The HTML is handed to `srcDoc` completely untransformed — no templating, no
 * string interpolation, no DOM sanitising. That is what keeps Power Automate
 * expressions such as @{outputs('Get_item')?['body/Title']} visible as plain
 * text: to an HTML parser they are ordinary character data, so the browser
 * renders them as-is while the surrounding markup lays out normally.
 *
 * `sandbox` omits `allow-scripts` and `allow-same-origin`, so a pasted template
 * cannot run script or reach back into the app. Email clients strip JavaScript
 * anyway, which makes a script-free preview the more faithful one.
 */
export function Preview({ html }: PreviewProps) {
  if (!html.trim()) {
    return (
      <div className="preview-empty">
        <p>Nothing to preview yet.</p>
        <p className="preview-empty-hint">
          Type or load an HTML template on the left, then press Run.
        </p>
      </div>
    )
  }

  return (
    <iframe
      className="preview-frame"
      title="Email preview"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={html}
    />
  )
}
