import Image from "next/image";

export default function BrandLogo() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/icons/book-bookmark.svg"
        alt=""
        width={36}
        height={36}
        aria-hidden="true"
        draggable={false}
      />

      <div>
        <h1 className="text-lg font-bold tracking-tight text-[#211f1b]">
          DrishtiVani
        </h1>
        <p className="text-xs text-[#3b362f]">Accessible learning</p>
      </div>
    </div>
  );
}
