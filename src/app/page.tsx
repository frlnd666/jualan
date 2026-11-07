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
    <main className="overflow-x-hidden">
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
