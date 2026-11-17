// pages/WhatsAppSettings.jsx
// Admin  -> links the COMPANY WhatsApp (admin + staff + website bookings send from it)
// Agent  -> links their OWN WhatsApp (their bookings send from it)
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  getWhatsAppOverviewAPI,
  getWhatsAppStatusAPI,
  connectWhatsAppAPI,
  reconnectWhatsAppAPI,
  disconnectWhatsAppAPI,
  testWhatsAppAPI,
} from "../services/operations/whatsappAPI";
import styles from "../styles/WhatsAppSettings.module.css";

const token = () => localStorage.getItem("authToken");
const errMsg = (e, fallback) => e?.response?.data?.message || fallback;

const POLL_STATES = ["offline", "starting", "qr", "pairing", "authenticated", "disconnected"];

const STATE_LABEL = {
  not_linked: ["Not connected", ""],
  stopped: ["Not connected", ""],
  failed: ["Needs attention", "Warn"],
  offline: ["Starting…", "Busy"],
  starting: ["Starting…", "Busy"],
  authenticated: ["Almost ready…", "Busy"],
  qr: ["Waiting for scan", "Busy"],
  pairing: ["Waiting for code", "Busy"],
  disconnected: ["Reconnecting…", "Warn"],
  ready: ["Connected", "Ready"],
};

function AccountCard({ initial, scope, companyId, title, subtitle }) {
  const [acct, setAcct] = useState(initial);
  const [method, setMethod] = useState("qr"); // qr | phone
  const [phone, setPhone] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const body = useCallback(
    (extra = {}) => ({ scope, ...(companyId ? { companyId } : {}), ...extra }),
    [scope, companyId]
  );

  // While linking / starting, ask the server for the latest state every 2.5 s
  useEffect(() => {
    if (!POLL_STATES.includes(acct.state)) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await getWhatsAppStatusAPI(token(), scope, companyId);
        setAcct((prev) => {
          if (prev.state !== "ready" && res.data.state === "ready") toast.success("WhatsApp connected");
          return res.data;
        });
      } catch {
        /* keep the last known state; try again next tick */
      }
    }, 2500);
    return () => clearInterval(id);
  }, [acct.state, scope, companyId]);

  const run = async (fn, failText) => {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      if (res?.data && res.data.state) setAcct(res.data);
      return res;
    } catch (e) {
      setError(errMsg(e, failText));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const connect = () => {
    if (method === "phone" && !phone.trim()) return setError("Enter the WhatsApp number (with country code if not Indian).");
    return run(
      () => connectWhatsAppAPI(token(), body(method === "phone" ? { phoneNumber: phone.trim() } : {})),
      "Could not start WhatsApp. Please try again."
    );
  };

  const reconnect = () => run(() => reconnectWhatsAppAPI(token(), body()), "Could not reconnect.");

  const disconnect = async () => {
    if (!window.confirm("Disconnect this WhatsApp? Customers will stop getting automatic messages until you link it again.")) return;
    const res = await run(() => disconnectWhatsAppAPI(token(), body()), "Could not disconnect.");
    if (res) toast.success("WhatsApp disconnected");
  };

  const sendTest = async () => {
    const res = await run(() => testWhatsAppAPI(token(), body({ to: testTo })), "Could not send the test message.");
    if (res) toast.success("Test message sent");
  };

  const [label, tone] = STATE_LABEL[acct.state] || ["", ""];
  const linking = ["starting", "authenticated", "offline"].includes(acct.state);
  const idle = ["not_linked", "stopped", "failed"].includes(acct.state);
  const cardClass = `${styles.card} ${acct.state === "ready" ? styles.cardReady : ""} ${
    acct.state === "failed" || acct.state === "disconnected" ? styles.cardWarn : ""
  }`;

  return (
    <div className={cardClass}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>{title}</h2>
          <p className={styles.cardSub}>{subtitle}</p>
        </div>
        <span className={`${styles.badge} ${tone ? styles[`badge${tone}`] : ""}`}>{label}</span>
      </div>

      {!acct.live && (
        <div className={styles.dev}>
          WhatsApp is switched off on this server (development mode), so it cannot be linked here.
        </div>
      )}

      {(error || acct.error) && acct.state !== "ready" && (
        <p className={styles.error}>{error || acct.error}</p>
      )}
      {error && acct.state === "ready" && <p className={styles.error}>{error}</p>}

      {acct.live && idle && (
        <>
          <p className={styles.note}>Choose how to link the number:</p>
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tab} ${method === "qr" ? styles.tabOn : ""}`} onClick={() => setMethod("qr")}>
              Scan QR code
            </button>
            <button type="button" className={`${styles.tab} ${method === "phone" ? styles.tabOn : ""}`} onClick={() => setMethod("phone")}>
              Use phone number
            </button>
          </div>
          <p className={styles.note}>
            {method === "qr"
              ? "Best on a computer: a QR code appears here and you scan it with the phone."
              : "Best if you are on the same phone: enter the WhatsApp number and you get an 8-character code to type into WhatsApp."}
          </p>
          {method === "phone" && (
            <div className={styles.row}>
              <input
                className={styles.input}
                placeholder="WhatsApp number, e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
            </div>
          )}
          <div className={styles.row}>
            <button type="button" className={styles.btn} onClick={connect} disabled={busy}>
              {busy ? "Starting…" : "Connect WhatsApp"}
            </button>
          </div>
        </>
      )}

      {linking && (
        <p className={styles.note}>
          <span className={styles.spinner} />
          Starting WhatsApp. This can take a minute or two…
        </p>
      )}

      {acct.state === "qr" && (
        <div className={styles.qrBox}>
          {acct.qr ? (
            <img className={styles.qrImg} src={acct.qr} alt="WhatsApp QR code" />
          ) : (
            <div className={styles.note}>
              <span className={styles.spinner} />
              Preparing the QR code…
            </div>
          )}
          <ol className={styles.steps}>
            <li>Open WhatsApp on the phone</li>
            <li>Tap <b>Linked devices</b> (Settings)</li>
            <li>Tap <b>Link a device</b></li>
            <li>Scan this QR code</li>
          </ol>
        </div>
      )}

      {acct.state === "pairing" && (
        <div className={styles.qrBox}>
          <div className={styles.code}>{acct.pairingCode || "…"}</div>
          <ol className={styles.steps}>
            <li>Open WhatsApp on that phone</li>
            <li>Tap <b>Linked devices</b>, then <b>Link a device</b></li>
            <li>Tap <b>Link with phone number instead</b></li>
            <li>Type the code shown here</li>
          </ol>
        </div>
      )}

      {acct.state === "ready" && (
        <>
          <p className={styles.note}>
            ✅ Connected{acct.phone ? <> as <b>+{acct.phone}</b></> : null}. Booking messages go out from this number.
          </p>
          <div className={styles.row}>
            <input
              className={styles.input}
              placeholder="Send a test to a mobile number"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              inputMode="tel"
            />
            <button type="button" className={`${styles.btn} ${styles.btnGreen}`} onClick={sendTest} disabled={busy || !testTo.trim()}>
              Send test
            </button>
          </div>
        </>
      )}

      {(acct.state === "disconnected" || acct.state === "offline") && (
        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={reconnect} disabled={busy}>
            Reconnect now
          </button>
        </div>
      )}

      {(acct.state === "ready" || acct.state === "disconnected" || acct.state === "offline" || acct.state === "failed") && (
        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={disconnect} disabled={busy}>
            Disconnect
          </button>
        </div>
      )}

      {(acct.state === "qr" || acct.state === "pairing" || acct.state === "starting") && (
        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={disconnect} disabled={busy}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppSettings({ user }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getWhatsAppOverviewAPI(token())
      .then((res) => !cancelled && setData(res.data))
      .catch((e) => !cancelled && setLoadError(errMsg(e, "Could not load WhatsApp settings.")));
    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = user?.type === "admin";

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>WhatsApp</h1>
      <p className={styles.lead}>
        {isAdmin
          ? "Link the company's WhatsApp number. Booking messages for bookings created by admin and staff, and by the website, are sent from it. Agents link their own numbers for their own bookings."
          : "Link your own WhatsApp number. Messages for bookings you create are sent to your customers from this number. If it is not linked, those customers get no automatic message."}
      </p>

      {loadError && <p className={styles.error}>{loadError}</p>}
      {!data && !loadError && (
        <p className={styles.note}>
          <span className={styles.spinner} />
          Loading…
        </p>
      )}

      {data && !data.live && (
        <div className={styles.dev}>
          WhatsApp is switched off on this server (development mode). You can look around, but numbers can only be linked on the live server.
        </div>
      )}

      {data?.companies?.map((c) => (
        <AccountCard
          key={c.key}
          initial={c}
          scope="company"
          companyId={c.companyId}
          title={`Company WhatsApp: ${c.label}`}
          subtitle="Used for bookings created by admin and staff, and by the website"
        />
      ))}

      {data?.me && (
        <AccountCard
          initial={data.me}
          scope="me"
          title="My WhatsApp"
          subtitle="Used for the bookings you create"
        />
      )}

      {data?.agents?.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Agents</h2>
              <p className={styles.cardSub}>Each agent links their own number. Their customers get messages only from it, never from the company number.</p>
            </div>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Agent</th>
                <th>WhatsApp</th>
                <th>Number</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => {
                const [label, tone] = STATE_LABEL[a.state] || ["", ""];
                return (
                  <tr key={a.employeeId}>
                    <td>{a.name}</td>
                    <td>
                      <span className={`${styles.badge} ${tone ? styles[`badge${tone}`] : ""}`}>{label}</span>
                    </td>
                    <td>{a.phone ? `+${a.phone}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data?.note && <p className={styles.note}>{data.note}</p>}
    </div>
  );
}
