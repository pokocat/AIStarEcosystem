import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Card } from "../components/Card";
import { Meter } from "../components/Meter";
import { KpiCard } from "../components/KpiCard";
import { DataTable, Column } from "../components/DataTable";

interface Persona {
  name: string;
  id: string;
  type: string;
  status: "live" | "training" | "paused";
  fidelity: number;
  streams: string;
  revenue: string;
}

const personas: Persona[] = [
  { name: "Aoki",       id: "MUS-0418", type: "Vocal · J-Pop",  status: "live",     fidelity: 94, streams: "12.4M", revenue: "¥2.10M" },
  { name: "Kuro Sora",  id: "MUS-0291", type: "Vocal · Synth",  status: "live",     fidelity: 91, streams: "8.9M",  revenue: "¥1.74M" },
  { name: "Sato Ren",   id: "MUS-0145", type: "Rap · Hip-Hop",  status: "live",     fidelity: 88, streams: "6.2M",  revenue: "¥980K"  },
  { name: "Lin Wei v2", id: "MUS-0177", type: "Vocal · C-Pop",  status: "training", fidelity: 72, streams: "—",     revenue: "—"      },
  { name: "Aiko",       id: "MUS-0388", type: "Vocal · Ballad", status: "live",     fidelity: 90, streams: "4.1M",  revenue: "¥720K"  },
  { name: "Mio · beta", id: "MUS-0512", type: "Vocal · Indie",  status: "paused",   fidelity: 65, streams: "0",     revenue: "—"      },
];

const statusTone = {
  live: "success",
  training: "warning",
  paused: "neutral",
} as const;

const columns: Column<Persona>[] = [
  {
    key: "name",
    header: "Persona",
    width: "2.2fr",
    render: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--bg-3), var(--line-2))",
            border: "1px solid var(--line-2)",
          }}
        />
        <div>
          <div style={{ color: "var(--fg-0)", fontWeight: 500 }}>{r.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{r.id}</div>
        </div>
      </div>
    ),
  },
  { key: "type", header: "Type" },
  {
    key: "status",
    header: "Status",
    render: (r) => <Chip tone={statusTone[r.status]}>● {r.status}</Chip>,
  },
  {
    key: "fidelity",
    header: "Voice fidelity",
    render: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ height: 4, background: "var(--bg-2)", borderRadius: 2, flex: 1, overflow: "hidden" }}>
          <div
            style={{
              width: `${r.fidelity}%`,
              height: "100%",
              background:
                r.fidelity > 85
                  ? "var(--success)"
                  : r.fidelity > 70
                  ? "var(--warning)"
                  : "var(--danger)",
            }}
          />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-1)", width: 24 }}>
          {r.fidelity}
        </span>
      </div>
    ),
  },
  { key: "streams", header: "Streams 30d", mono: true },
  { key: "revenue", header: "Revenue", mono: true },
];

export function PersonasOverview() {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <div className="eyebrow">AI Musician · Production</div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: "6px 0 4px",
            }}
          >
            Personas overview
          </h1>
          <div style={{ fontSize: 13, color: "var(--fg-2)" }}>
            12 active · 3 training · 1 paused — last sync 2 min ago
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div
            style={{
              display: "flex",
              background: "var(--bg-1)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
              padding: 2,
            }}
          >
            {["24h", "7d", "30d", "90d"].map((t, i) => (
              <div
                key={t}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: i === 2 ? "var(--fg-0)" : "var(--fg-2)",
                  background: i === 2 ? "var(--bg-3)" : "transparent",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm">⤴ Filter</Button>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Active personas" value="12" delta="+2 this month" tone="accent" spark={[40,55,48,60,72,68,84]} />
        <KpiCard label="Streams · 30d"   value="38.2M" delta="+12.4% vs prior" tone="success" spark={[22,28,30,42,46,50,62]} />
        <KpiCard label="Revenue · 30d"   value="¥6.84M" delta="+8.1%" tone="info" spark={[30,35,40,38,52,58,64]} />
        <KpiCard label="GPU utilization" value="67%" delta="4 clusters · 1 alert" tone="warning" spark={[50,62,55,70,65,72,67]} />
      </div>

      {/* Two-col: activity + meters */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 20 }}>
        <Card style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>System health</div>
          <Meter label="GPU · render queue" value={62} tone="accent" />
          <Meter label="Voice fidelity"    value={88} tone="success" />
          <Meter label="License quota"     value={34} tone="warning" />
        </Card>
        <Card style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Quick actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="primary">Train new persona</Button>
            <Button variant="secondary">Import voice sample</Button>
            <Button variant="ghost">View rights ledger</Button>
          </div>
        </Card>
      </div>

      {/* Table */}
      <DataTable
        caption="All personas"
        meta={`${personas.length} records · sorted by revenue`}
        columns={columns}
        rows={personas}
        rightSlot={
          <div style={{ display: "flex", gap: 6 }}>
            <Button variant="ghost" size="sm">Columns</Button>
            <Button variant="secondary" size="sm">⇣ CSV</Button>
          </div>
        }
      />
    </>
  );
}
