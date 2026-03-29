import { HomeClient } from "@/components/home-client";
import { hasSupabasePublicEnv } from "@/lib/env";

export default function Home() {
  return <HomeClient hasSupabaseConfig={hasSupabasePublicEnv} />;
}
