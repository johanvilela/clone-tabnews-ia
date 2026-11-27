import ConfettiBurst from "./confetti-burst";

const TABNEWS_URL = "https://www.tabnews.com.br";
const TABNEWS_CONTENTS_API =
  "https://www.tabnews.com.br/api/v1/contents?strategy=new&per_page=1";

// Garante que o total seja consultado na API pública a cada acesso.
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getTotalContents(): Promise<number | null> {
  try {
    const response = await fetch(TABNEWS_CONTENTS_API, { cache: "no-store" });

    if (!response.ok) return null;

    const total = Number(response.headers.get("x-pagination-total-rows"));

    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const total = await getTotalContents();
  const formattedTotal =
    total === null ? null : new Intl.NumberFormat("pt-BR").format(total);

  return (
    <main className="construction">
      <ConfettiBurst />

      <section className="card">
        <span className="badge">🚧 Obras em andamento</span>

        <h1>Em Construção</h1>

        <p className="lead">
          Estamos reconstruindo o TabNews, um lugar na internet para quem
          trabalha com tecnologia e precisa consumir conteúdos com valor
          concreto.
        </p>

        <div className="counter">
          <span className="counter-label">
            Conteúdos publicados no TabNews
          </span>

          {formattedTotal === null ? (
            <span className="counter-value unavailable">
              Não foi possível consultar agora
            </span>
          ) : (
            <strong className="counter-value">{formattedTotal}</strong>
          )}

          <span className="counter-note">Total atualizado a cada visita</span>
        </div>

        <a
          className="official-link"
          href={TABNEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Visitar o site oficial do TabNews
          <span aria-hidden="true">→</span>
        </a>
      </section>

      <footer className="footer">
        Feito com dedicação para a comunidade de tecnologia 💚
      </footer>
    </main>
  );
}
