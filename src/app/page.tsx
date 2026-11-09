import {
  DemoGrid,
  FaqSection,
  FeatureGrid,
  FinalCta,
  HeroSection,
  MobileExperience,
  Navbar,
  PricingSection,
  StepsSection,
  TrustSection,
} from "@/components/storefront/home";

export default function HomePage() {
  return (
    <main className="overflow-x-hidden pb-[84px] md:pb-0">
      <Navbar />
      <HeroSection />
      <TrustSection />
      <DemoGrid />
      <StepsSection />
      <FeatureGrid />
      <MobileExperience />
      <PricingSection />
      <FaqSection />
      <FinalCta />
    </main>
  );
}
