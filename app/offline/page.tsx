import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[#E8EDF4] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-[#202735]">You’re offline</h1>
        <p className="mt-3 text-sm leading-6 text-[#8992A3]">
          Spendly couldn’t reach the server. Your financial information isn’t
          available offline, and no changes have been saved. Reconnect and try
          again to see current data.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2878E5] px-5 text-sm font-semibold text-white hover:bg-[#1F65C2]"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
