import { Card, Field, Select, Toggle } from "../ui";
import { SPEED_CHOICES, SKIP_CHOICES, PLAYER_STYLES } from "../../../../data/audioPageDefaults";

// Playback settings — apply to the whole app's player (not one page).
export default function PlaybackSection({ playback, upPlayback, canEdit }) {
  const speedOptions = SPEED_CHOICES.map((s) => [String(s), `${s}×`]);
  const skipOptions = SKIP_CHOICES.map((s) => [String(s), `${s} seconds`]);
  return (
    <>
      <Card title="Speed & skipping" hint="Defaults for people who haven't picked their own. Anyone who changes speed or a skip length in the player keeps their own choice.">
        <Field label="Default playback speed"><Select value={String(playback.defaultSpeed)} onChange={(v) => upPlayback("defaultSpeed", Number(v))} options={speedOptions} disabled={!canEdit} /></Field>
        <Toggle label="Remember each listener's last speed" hint="Off: every new recording starts at the default speed again." checked={playback.rememberSpeed} onChange={(v) => upPlayback("rememberSpeed", v)} disabled={!canEdit} />
        <Field label="Skip back"><Select value={String(playback.skipBack)} onChange={(v) => upPlayback("skipBack", Number(v))} options={skipOptions} disabled={!canEdit} /></Field>
        <Field label="Skip forward"><Select value={String(playback.skipForward)} onChange={(v) => upPlayback("skipForward", Number(v))} options={skipOptions} disabled={!canEdit} /></Field>
      </Card>

      <Card title="Behavior">
        <Toggle label="Remember playback position" hint="Off: the app stops saving where people left off — no “Resume”, and “Continue listening” has nothing to show." checked={playback.rememberPosition} onChange={(v) => upPlayback("rememberPosition", v)} disabled={!canEdit} />
        <Toggle label="Auto-play the next recording" hint="Off: playback stops when a recording ends (unless someone set repeat)." checked={playback.autoPlayNext} onChange={(v) => upPlayback("autoPlayNext", v)} disabled={!canEdit} />
        <Toggle label="Show playback progress" hint="The progress bars on cards and in the mini player." checked={playback.showProgress} onChange={(v) => upPlayback("showProgress", v)} disabled={!canEdit} />
        <Toggle label="Allow background playback" hint="Off: audio pauses when the app or tab is sent to the background or the screen locks." checked={playback.backgroundPlayback} onChange={(v) => upPlayback("backgroundPlayback", v)} disabled={!canEdit} />
      </Card>

      <Card title="Player appearance" hint="The full player page's artwork.">
        <Field label="Default player appearance"><Select value={playback.playerStyle} onChange={(v) => upPlayback("playerStyle", v)} options={PLAYER_STYLES} disabled={!canEdit} /></Field>
        <PlayerSketch style={playback.playerStyle} />
      </Card>
    </>
  );
}

// A tiny drawing of the chosen player layout.
function PlayerSketch({ style }) {
  const size = style === "standard" ? 84 : style === "compact" ? 54 : 0;
  return (
    <div style={sketch} aria-hidden="true">
      {size > 0 && <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-e08930), var(--color-a85e18))", marginBottom: "10px" }} />}
      <div style={{ width: "120px", height: "9px", borderRadius: "5px", background: "var(--color-3d2200)", opacity: 0.8 }} />
      <div style={{ width: "80px", height: "7px", borderRadius: "5px", background: "var(--color-9b7040)", opacity: 0.6, margin: "6px 0 12px" }} />
      <div style={{ width: "150px", height: "5px", borderRadius: "5px", background: "var(--color-eddfc8)" }} />
      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ width: i === 1 ? 26 : 18, height: i === 1 ? 26 : 18, borderRadius: "50%", background: i === 1 ? "var(--color-c97c2e)" : "var(--color-eddfc8)" }} />)}
      </div>
    </div>
  );
}
const sketch = { display: "flex", flexDirection: "column", alignItems: "center", padding: "14px", borderRadius: "12px", background: "var(--color-fdf8f3)", border: "1px dashed var(--color-eddfc8)" };
