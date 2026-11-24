"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

interface ReadAloudButtonProps {
  text: string;
}

const emptySubscribe = () => () => {};
const getSpeechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;
const getServerSnapshot = () => false;

export default function ReadAloudButton({ text }: ReadAloudButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const supported = useSyncExternalStore(
    emptySubscribe,
    getSpeechSupported,
    getServerSnapshot,
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  const toggleSpeech = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={toggleSpeech}
      aria-pressed={speaking}
      aria-label={
        speaking
          ? "Stop reading page aloud"
          : "Listen to this page read aloud"
      }
      className="sketch-button-secondary min-h-[52px] px-6 py-3 text-base"
    >
      <Image
        src={
          speaking
            ? "/icons/alerts-stop-sign.svg"
            : "/icons/volume-control-up-1.svg"
        }
        alt=""
        width={22}
        height={22}
        aria-hidden="true"
        draggable={false}
      />
      <span>{speaking ? "Stop audio" : "Listen to page"}</span>
    </button>
  );
}
