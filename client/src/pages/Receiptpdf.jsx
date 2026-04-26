import {
  Document, Page, Text, View, StyleSheet, Line, Svg,
} from "@react-pdf/renderer";

/* ── helpers ── */
const fmtLong = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const fmtShort = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const to12 = (t) => {
  if (!t) return "";
  let [h, m] = t.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}${m ? `:${String(m).padStart(2, "0")}` : ""}${p}`;
};

const fmtINR = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inWords = (n) => {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const convert = (num) => {
    if (num === 0) return "";
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? " " + a[num % 10] : "");
    if (num < 1000) return a[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + convert(num % 100) : "");
    if (num < 100000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + convert(num % 1000) : "");
    if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + convert(num % 100000) : "");
    return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + convert(num % 10000000) : "");
  };
  const rupees = Math.floor(n);
  const paise  = Math.round((n - rupees) * 100);
  let result = convert(rupees) + " Rupees";
  if (paise > 0) result += " and " + convert(paise) + " Paise";
  return result + " Only";
};

const receiptNo = (booking) => {
  const d = new Date(booking.date || booking.createdAt);
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const code = (booking.company?.code || "GYW").toUpperCase();
  const suffix = booking._id.slice(-4).toUpperCase();
  return `${code}/${yyyy}-${mm}/${dd}${suffix}`;
};

const parseExtras = (raw = "") => {
  const txt = raw.replace(/\u2022|\u2023|\u25E6/g,"-").replace(/\u200B|\u200C|\u200D|\uFEFF/g,"").replace(/\r\n/g,"\n").replace(/\n{2,}/g,"\n").trim();
  const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean);
  const inclusions = lines.filter((l) => ["Soft Drink","Ice","Music","Water","Bluetooth","Captain","Snacks"].some((k) => l.includes(k)));
  const paid = lines.filter((l) => ["Drone","DSLR","Food","DJ","Photography"].some((k) => l.includes(k)));
  return { inclusions, paid };
};

/* ── Palette ── */
const INK     = "#0A0A0A";
const SUBINK  = "#2D2D2D";
const MID     = "#5C5C5C";
const MUTED   = "#8C8C8C";
const RULE    = "#D4D4D4";
const LITE    = "#F5F5F5";
const WHITE   = "#FFFFFF";
const ACCENT  = "#1A3A5C";   /* deep navy */
const ACCENTL = "#E8EEF5";   /* accent tint */

/* ── Styles ── */
const S = StyleSheet.create({

  page: {
    paddingTop: 52, paddingBottom: 70,
    paddingLeft: 52, paddingRight: 52,
    backgroundColor: WHITE,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
  },

  /* ─ Masthead ─ */
  masthead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 28,
    paddingBottom: 22,
    borderBottom: `2 solid ${INK}`,
  },
  companyName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: INK,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  companyTagline: {
    fontSize: 8,
    color: MUTED,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  receiptWord: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    letterSpacing: 4,
    textTransform: "uppercase",
    textAlign: "right",
  },
  receiptNum: {
    fontSize: 9,
    color: MID,
    textAlign: "right",
    marginTop: 3,
    letterSpacing: 0.5,
  },

  /* ─ Meta row (from / to / date) ─ */
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  metaCol: { flex: 1, paddingRight: 12 },
  metaColRight: { flex: 1, alignItems: "flex-end" },
  metaHeading: {
    fontSize: 7.5, fontFamily: "Helvetica-Bold",
    color: MUTED, letterSpacing: 2, textTransform: "uppercase",
    marginBottom: 6,
  },
  metaLine: {
    fontSize: 10, fontFamily: "Helvetica-Bold", color: SUBINK, marginBottom: 2,
  },
  metaLineSmall: {
    fontSize: 8.5, color: MID, lineHeight: 1.55,
  },

  /* ─ Table ─ */
  tableWrap: { marginBottom: 0 },
  tableHead: {
    flexDirection: "row",
    borderTop: `1.5 solid ${INK}`,
    borderBottom: `1 solid ${INK}`,
    paddingVertical: 7,
  },
  thDesc: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 1.5, textTransform: "uppercase" },
  thQty:  { width: 56, fontSize: 8, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center" },
  thAmt:  { width: 80, fontSize: 8, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 1.5, textTransform: "uppercase", textAlign: "right" },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottom: `0.5 solid ${RULE}`,
  },
  tdMain: { flex: 1, paddingRight: 10 },
  tdTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: SUBINK, marginBottom: 4 },
  tdSub:   { fontSize: 9, color: MID, lineHeight: 1.55, marginBottom: 2 },
  tdBadge: { fontSize: 8, color: ACCENT, marginTop: 4 },
  tdQty:   { width: 56, fontSize: 10, color: MID, textAlign: "center", paddingTop: 1 },
  tdAmt:   { width: 80, fontSize: 12, fontFamily: "Helvetica-Bold", color: SUBINK, textAlign: "right", paddingTop: 1 },

  /* Inclusions sub-row */
  inclRow: {
    paddingTop: 10, paddingBottom: 14,
    borderBottom: `0.5 solid ${RULE}`,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  inclLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", paddingTop: 1.5, width: 56 },
  inclText:  { flex: 1, fontSize: 8.5, color: MID, lineHeight: 1.55 },

  /* Totals */
  totalsWrap: { marginTop: 4 },
  totalLineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  totalLineLabel: { fontSize: 9, color: MID },
  totalLineVal:   { fontSize: 9, color: MID, textAlign: "right" },

  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingTop: 10,
    paddingBottom: 10,
    borderTop: `1.5 solid ${INK}`,
    borderBottom: `1.5 solid ${INK}`,
    marginTop: 4,
  },
  grandLabel: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 1 },
  grandVal:   { fontSize: 18, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: -0.5 },

  inWords: {
    fontSize: 8, color: MUTED, fontStyle: "italic",
    textAlign: "right", marginTop: 6, lineHeight: 1.4,
  },

  balanceBox: {
    marginTop: 12,
    padding: "9 14",
    backgroundColor: ACCENTL,
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: ACCENT },
  balVal:   { fontSize: 11, fontFamily: "Helvetica-Bold", color: ACCENT },

  paidBox: {
    marginTop: 12,
    padding: "9 14",
    backgroundColor: "#E8F5EE",
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paidLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#15803d" },
  paidVal:   { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#15803d" },

  /* Terms */
  termsWrap: { marginTop: 24 },
  termsHead: {
    fontSize: 7.5, fontFamily: "Helvetica-Bold",
    letterSpacing: 2, textTransform: "uppercase",
    color: MUTED, marginBottom: 8,
  },
  termsLine: { fontSize: 8, color: MID, lineHeight: 1.6, marginBottom: 1 },

  /* Closing */
  closing: { marginTop: 22 },
  closingText: { fontSize: 10, color: MID, lineHeight: 1.65 },
  closingName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: SUBINK, marginTop: 6, letterSpacing: 0.3 },

  /* Footer */
  footer: {
    position: "absolute",
    bottom: 28, left: 52, right: 52,
  },
  footerRule: { borderTop: `0.5 solid ${RULE}`, marginBottom: 8 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft:  { fontSize: 7.5, color: MUTED },
  footerCenter: { fontSize: 7.5, color: MUTED, textAlign: "center" },
  footerRight:  { fontSize: 7.5, color: MUTED, textAlign: "right" },
});

/* ── Component ── */
export default function ReceiptPDF({ booking }) {
  if (!booking) return null;

  const company  = booking.company    || {};
  const customer = booking.customerId || {};
  const yacht    = booking.yachtId    || {};
  const { inclusions, paid } = parseExtras(booking.extraDetails || "");

  const tripDate  = fmtShort(booking.date);
  const billDate  = fmtLong(booking.createdAt || new Date());
  const startT    = to12(booking.startTime);
  const endT      = to12(booking.endTime);
  const sailH     = booking.sailingHours   ?? 1;
  const anchH     = booking.anchoringHours ?? 1;
  const total     = Number(booking.quotedAmount  || 0);
  const pending   = Number(booking.pendingAmount || 0);
  const tokenPaid = total - pending;
  const rNo       = receiptNo(booking);
  const digitalCode = `${(booking.company?.code || "GYW").toUpperCase()}-${booking._id.slice(0,8).toUpperCase()}-${booking._id.slice(-4).toUpperCase()}`;
  const cName  = company.name    || "Goa Yacht World";
  const cWeb   = company.website || "goayachtworld.com";
  const cPhone = company.contact || "8446275985";

  return (
    <Document>
      <Page size="A4" style={S.page} wrap={false}>

        {/* ─── MASTHEAD ─── */}
        <View style={S.masthead}>
          <View>
            <Text style={S.companyName}>{cName}</Text>
            <Text style={S.companyTagline}>Luxury Yacht Experiences</Text>
          </View>
          <View>
            <Text style={S.receiptWord}>Receipt</Text>
            {/* <Text style={S.receiptNum}>{rNo}</Text> */}
          </View>
        </View>

        {/* ─── FROM / BILL TO / DATE META ─── */}
        <View style={S.metaRow}>
          <View style={S.metaCol}>
            <Text style={S.metaHeading}>From</Text>
            <Text style={S.metaLine}>{cName}</Text>
            <Text style={S.metaLineSmall}>{cPhone}</Text>
            <Text style={S.metaLineSmall}>{cWeb}</Text>
          </View>

          <View style={S.metaCol}>
            <Text style={S.metaHeading}>Bill To</Text>
            <Text style={S.metaLine}>{customer.name || "—"}</Text>
            {customer.contact && <Text style={S.metaLineSmall}>{customer.contact}</Text>}
            {customer.email   && <Text style={S.metaLineSmall}>{customer.email}</Text>}
          </View>

          <View style={S.metaColRight}>
            <Text style={S.metaHeading}>Issue Date</Text>
            <Text style={[S.metaLine, { textAlign: "right" }]}>{billDate}</Text>
            <Text style={[S.metaLineSmall, { textAlign: "right", marginTop: 8 }]}>
              Ref: #{booking._id?.slice(-6).toUpperCase() || "------"}
            </Text>
          </View>
        </View>

        {/* ─── TABLE ─── */}
        <View style={S.tableWrap}>
          {/* Header */}
          <View style={S.tableHead}>
            <Text style={S.thDesc}>Description</Text>
            <Text style={S.thQty}>Qty</Text>
            <Text style={S.thAmt}>Amount</Text>
          </View>

          {/* Main row */}
          <View style={S.tableRow}>
            <View style={S.tdMain}>
              <Text style={S.tdTitle}>
                Yacht Charter — {yacht.name || "Private Yacht"}
                {booking.numPeople ? `  ·  ${booking.numPeople} Guests` : ""}
              </Text>
              <Text style={S.tdSub}>
                {tripDate}   {startT && endT ? `  ·  ${startT} – ${endT}` : ""}
              </Text>
              <Text style={S.tdSub}>
                {sailH}hr Cruising  +  {anchH}hr Anchorage
              </Text>
              {paid.length > 0 && (
                <Text style={S.tdBadge}>
                  Add-ons: {paid.map((p) => p.replace(/^-\s*/, "")).join("  ·  ")}
                </Text>
              )}
            </View>
            <Text style={S.tdQty}>1</Text>
            <Text style={S.tdAmt}> {fmtINR(total)}</Text>
          </View>

          {/* Inclusions sub-row */}
          {inclusions.length > 0 && (
            <View style={S.inclRow}>
              <Text style={S.inclLabel}>Included</Text>
              <Text style={S.inclText}>
                {inclusions.map((i) => i.replace(/^-\s*/, "")).join("   ·   ")}
              </Text>
            </View>
          )}

          {/* Totals section */}
          <View style={S.totalsWrap}>
            {tokenPaid > 0 && (
              <>
                <View style={S.totalLineRow}>
                  <Text style={S.totalLineLabel}>Subtotal</Text>
                  <Text style={S.totalLineVal}> {fmtINR(total)}</Text>
                </View>
                <View style={S.totalLineRow}>
                  <Text style={S.totalLineLabel}>Advance Paid</Text>
                  <Text style={[S.totalLineVal, { color: "#15803d" }]}>–  {fmtINR(tokenPaid)}</Text>
                </View>
              </>
            )}

            <View style={S.grandRow}>
              <Text style={S.grandLabel}>TOTAL</Text>
              <Text style={S.grandVal}> {fmtINR(total)}</Text>
            </View>
            <Text style={S.inWords}>{inWords(total)}</Text>

            {/* Balance or paid */}
            {pending > 0 ? (
              <View style={S.balanceBox}>
                <Text style={S.balLabel}>Balance Payable Before Boarding</Text>
                <Text style={S.balVal}> {fmtINR(pending)}</Text>
              </View>
            ) : (
              <View style={S.paidBox}>
                <Text style={S.paidLabel}>✓  Payment Complete</Text>
                <Text style={S.paidVal}>Fully Settled</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── TERMS ─── */}
        <View style={S.termsWrap}>
          <Text style={S.termsHead}>Terms &amp; Conditions</Text>
          <Text style={S.termsLine}>1.  Full payment is required before boarding. No boarding will be permitted with outstanding balance.</Text>
          <Text style={S.termsLine}>2.  Accepted payment methods: Cash or UPI only.</Text>
          <Text style={S.termsLine}>3.  Cancellations made less than 24 hours prior to departure are non-refundable.</Text>
          <Text style={S.termsLine}>4.  The company reserves the right to cancel the charter due to adverse weather or safety concerns.</Text>
        </View>

        {/* ─── CLOSING ─── */}
        <View style={S.closing}>
          <Text style={S.closingText}>
            Thank you for choosing {cName}. For any queries regarding this receipt, please contact us at {cPhone}.
          </Text>
          <Text style={S.closingName}>{cName}</Text>
        </View>

        {/* ─── FOOTER ─── */}
        <View style={S.footer}>
          <View style={S.footerRule} />
          <View style={S.footerRow}>
            <Text style={S.footerLeft}>This is a computer-generated document. No signature required.</Text>
            <Text style={S.footerCenter}>{cWeb}</Text>
            <Text style={S.footerRight}>Code: {digitalCode}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}