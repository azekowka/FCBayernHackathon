import Link from 'next/link';
import { LogoMark } from './Logo';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t hairline">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-fg-3 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div className="max-w-md">
          <div className="flex items-center gap-2 text-fg">
            <LogoMark size={22} />
            <span className="display text-base font-bold">Fan AI Lab</span>
          </div>
          <p className="mt-3 leading-relaxed">
            Independent hackathon prototype for the FC Bayern Fan AI-DEATION (with Google Gemini and
            UnternehmerTUM). Not an official FC Bayern product. All members, tickets and travel data
            are synthetic and illustrative.
          </p>
        </div>
        <div>
          <p className="font-semibold text-fg-2">Products</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link className="hover:text-fg" href="/ballot">
                Losglück mit System
              </Link>
            </li>
            <li>
              <Link className="hover:text-fg" href="/recycling">
                Kein Platz bleibt leer
              </Link>
            </li>
            <li>
              <Link className="hover:text-fg" href="/journey">
                Vom Sofa bis zum Sitz
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-fg-2">Principles</p>
          <ul className="mt-3 space-y-2">
            <li>No dynamic pricing — face value only</li>
            <li>No biometrics, opt-in signals only</li>
            <li>Engines decide, Gemini explains</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
