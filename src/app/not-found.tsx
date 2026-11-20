import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-5xl">🛍️</p>
      <h1 className="text-xl font-bold">This store doesn&apos;t exist (yet)</h1>
      <Link href="/create" className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">
        Build your own store
      </Link>
    </div>
  );
}
