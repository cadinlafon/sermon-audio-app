import { Card, Field, Select, Toggle, OrderList, CheckGrid } from "../ui";
import { SORT_OPTIONS, VIEWS, CARD_LAYOUTS, GROUP_BY, PRIMARY_BUTTONS, MORE_BUTTONS, CARD_DETAILS } from "../../../../data/audioPageDefaults";

// Layout & Cards: default sort/view, card layout, expanded state, grouping,
// the order + visibility of card buttons, and which details a card shows.
export default function LayoutSection({ page, up, setPage, canEdit }) {
  const { layout, card } = page;
  const setButton = (id, value) => setPage((p) => ({ ...p, card: { ...p.card, buttons: { ...p.card.buttons, [id]: value } } }));
  const setDetail = (id, value) => setPage((p) => ({ ...p, card: { ...p.card, details: { ...p.card.details, [id]: value } } }));

  return (
    <>
      <Card title="Page layout" hint="How the list opens for a visitor. They can still change the sort and switch between list and grid themselves — their choice is remembered.">
        <Field label="Default sort"><Select value={layout.defaultSort} onChange={(v) => up("layout", "defaultSort", v)} options={SORT_OPTIONS} disabled={!canEdit} /></Field>
        <Field label="Default view"><Select value={layout.defaultView} onChange={(v) => up("layout", "defaultView", v)} options={VIEWS} disabled={!canEdit} /></Field>
        <Field label="Card layout" hint="Compact fits more on screen; Spacious gives each card more room."><Select value={layout.cardLayout} onChange={(v) => up("layout", "cardLayout", v)} options={CARD_LAYOUTS} disabled={!canEdit} /></Field>
        <Field label="Group the list" hint="Adds a heading above each group. Its look is set under Appearance → Category header."><Select value={layout.groupBy} onChange={(v) => up("layout", "groupBy", v)} options={GROUP_BY} disabled={!canEdit} /></Field>
        <Toggle label="Cards start expanded" hint="On: each card opens with its extra actions (View Transcript, Copy link, Share…) already showing. Off: they sit behind the More button." checked={layout.defaultExpanded} onChange={(v) => up("layout", "defaultExpanded", v)} disabled={!canEdit} />
      </Card>

      <Card title="Card buttons — order & visibility" hint="Use ▲▼ to rearrange and Shown/Hidden to switch each one. If More is hidden, the actions inside it are shown directly on the card.">
        <Field label="Main row"><OrderList items={PRIMARY_BUTTONS} order={card.buttonOrder} onOrder={(o) => setPage((p) => ({ ...p, card: { ...p.card, buttonOrder: o } }))} enabled={card.buttons} onEnabled={setButton} disabled={!canEdit} /></Field>
        <Field label="Inside “More”"><OrderList items={MORE_BUTTONS} order={card.moreOrder} onOrder={(o) => setPage((p) => ({ ...p, card: { ...p.card, moreOrder: o } }))} enabled={card.buttons} onEnabled={setButton} disabled={!canEdit} /></Field>
      </Card>

      <Card title="Card details" hint="Choose what each card shows. (Sharing, downloads and favorites can also be switched off for the whole app under Advanced.)">
        <CheckGrid items={CARD_DETAILS} values={card.details} onChange={setDetail} disabled={!canEdit} />
      </Card>
    </>
  );
}
