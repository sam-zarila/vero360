import Navbar from '@/app/components/landing/navbar'
import HeroSection from './components/landing/HeroSection'
import TrustBar from './components/landing/TrustBar'
import AnnouncementsSection from './components/landing/AnnouncementsSection'
import HowItWorks from './components/landing/HowItWorks'
import ServicesSection from './components/landing/ServicesSection'
import TestimonialsSection from './components/landing/Testimonialssection'
import ContactSection from './components/landing/ContactSection'
import AboutUsSection from './components/landing/AboutUsSection'
import CTASection from './components/Ctasection'
import Footer from './components/landing/Footer '


export default function Page() {
  return (
    <div>
      <Navbar />
      <HeroSection />
      <TrustBar />
      <AnnouncementsSection />
      <HowItWorks /> 
      <ServicesSection />
      <TestimonialsSection />
      <ContactSection />
      <AboutUsSection />
      <CTASection />
      <Footer />
    </div>
  )
}