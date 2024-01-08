import AiChatbot from "@/components/chat/ai-chatbot";
import VaccineSearch from "@/components/search/vaccine-search";

export default function HomePage() {
  return (
    <>
      <VaccineSearch />
      <AiChatbot />
    </>
  );
}
