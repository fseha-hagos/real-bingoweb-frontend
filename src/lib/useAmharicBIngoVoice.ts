export function useAmharicBingoVoice() {
    const speak = (letter: string, number: number) => {
        const text = `${letter} ${number}`;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "am-ET"; // 🇪🇹 Amharic
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    };

    return { speak };
}