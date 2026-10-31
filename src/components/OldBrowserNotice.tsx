const MODERN_CHROME = 111;
const UNUSABLE_CHROME = 80;
const PLAY_STORE_LINK = "https://play.google.com/store/apps/details?id=com.android.chrome";
const CHROME_LINK = "https://www.google.com/chrome/";

const checkBrowser = `(function () {
  var agent = navigator.userAgent;
  var match = agent.match(/Chrome\\/(\\d+)/);
  if (!match || agent.indexOf("; wv)") > -1) return;
  var version = parseInt(match[1], 10);
  if (version >= ${MODERN_CHROME}) return;
  var notice = document.getElementById("old-browser-notice");
  var close = document.getElementById("old-browser-close");
  document.getElementById("old-browser-link").href = /Android/.test(agent) ? "${PLAY_STORE_LINK}" : "${CHROME_LINK}";
  notice.style.display = "block";
  if (version < ${UNUSABLE_CHROME}) {
    notice.style.bottom = "0";
    close.style.display = "none";
    return;
  }
  close.onclick = function () {
    notice.style.display = "none";
  };
})();`;

export default function OldBrowserNotice() {
  return (
    <>
      <div
        id="old-browser-notice"
        role="alert"
        suppressHydrationWarning
        style={{ display: "none", position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, padding: "12px 44px 12px 16px", background: "#fffbeb", color: "#78350f", fontSize: 14, lineHeight: 1.4, borderBottom: "1px solid #fcd34d" }}
      >
        Your Chrome is out of date. Please update it so pictures and payments work properly.{" "}
        <a id="old-browser-link" href={PLAY_STORE_LINK} style={{ color: "#78350f", fontWeight: 700, textDecoration: "underline" }}>
          Update Chrome
        </a>
        <button id="old-browser-close" type="button" aria-label="Close" style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, border: 0, background: "none", color: "#78350f", fontSize: 20 }}>
          ×
        </button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: checkBrowser }} />
    </>
  );
}
