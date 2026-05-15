import {
  DemoGrid,
  FaqSection,
  FeatureGrid,
  FinalCta,
  HeroSection,
  MobileExperience,
  Navbar,
  PricingSection,
  SocialProof,
  StepsSection,
  TrustSection,
} from "@/components/storefront/home";

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <DemoGrid />
      <TrustSection />
      <StepsSection />
      <FeatureGrid />
      <MobileExperience />
      <SocialProof />
      <PricingSection />
      <FaqSection />
      <FinalCta />
    </main>
  );
}