import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Wrench, ShoppingBag, DollarSign, Star, Smartphone, Tablet, Laptop, ArrowRight, ChevronRight } from "lucide-react";
import heroBg from "../assets/bkg_img17.webp";
import smartphoneImg from "../assets/smartphone.png";
import tabletImg from "../assets/tablet.png";
import macbookProImg from "../assets/111901_mbp16-gray.png";
import samsungLogo from "../assets/samsung_logo.png";
import hpLogo from "../assets/hp_logo.png";
import appleLogo from "../assets/apple_logo.png";
import googleLogo from "../assets/google_logo.png";
import lenovoLogo from "../assets/lenovo_logo.png";

const reviews = [
  {
    name: "Rubadee",
    url: "https://g.co/kgs/siaD5Jj",
    text: "I've been dealing with Khan for 15+ years for my phones, laptops, etc. Always comes through. His work and pricing are always on point. You know he's good to be in business for so many years. Highly recommended.",
  },
  {
    name: "Rob Costabile",
    url: "https://g.co/kgs/Wi9NcJP",
    text: "I have been going to Electroshack for the last 16 years. As my family has grown, they have helped us all along the way. From repairing the kids ipads, broken screens, to now repairing the kids phones. Electroshack has always been my one and only repair shop. Owner & staff are classy, knowledgeable and professional.",
  },
  {
    name: "Angelita Banton",
    url: "https://g.co/kgs/UToAoqe",
    text: "I like this store as the owner is really customer focused. He does not charge you exorbitant prices because he knows the value of his labour. He usually does an abreast job fixing or restoring your electronics. He is very fair.",
  },
];

const slides = [
  {
    img: smartphoneImg,
    alt: "Smartphone",
    icon: Smartphone,
    size: "phone",
    title: "Smartphone Repair",
    desc: "Expert technicians handle everything from cracked screens and battery replacements to charge port and water damage repairs. Most repairs done in under an hour.",
  },
  {
    img: tabletImg,
    alt: "Tablet",
    icon: Tablet,
    size: "tablet",
    title: "Tablet Repair",
    desc: "Whether your tablet has a cracked screen, battery issues, or software glitches, our experienced team restores your device to full function. All major brands serviced.",
  },
  {
    img: macbookProImg,
    alt: "MacBook Pro",
    icon: Laptop,
    size: "laptop",
    title: "Computer & Laptop Repair",
    desc: "Comprehensive services from screen and keyboard repairs to motherboard fixes and data recovery. Detailed diagnostics with transparent pricing.",
  },
];

/** Exit iris duration must match --es-exit-total in index.css (0.96s) */
const CAROUSEL_EXIT_MS = 960;

/** Services carousel: bar train + copy; advance on cycle ticker iteration. */
export default function Home() {
  const [slideIdx, setSlideIdx] = useState(0);
  const [carouselDeckKey, setCarouselDeckKey] = useState(0);
  const [carouselExiting, setCarouselExiting] = useState(false);
  const skipNextAutoRef = useRef(false);
  const pendingSlideIdxRef = useRef(null);
  const lastLoopAt = useRef(0);
  const exitingRef = useRef(false);

  const goToNextSlide = useCallback(() => {
    setSlideIdx((i) => {
      const pending = pendingSlideIdxRef.current;
      pendingSlideIdxRef.current = null;
      if (pending !== null && pending !== undefined) return pending;
      return (i + 1) % slides.length;
    });
    setCarouselDeckKey((k) => k + 1);
  }, []);

  const finishCarouselExit = useCallback(() => {
    if (!exitingRef.current) return;
    exitingRef.current = false;
    setCarouselExiting(false);
    goToNextSlide();
  }, [goToNextSlide]);

  const startCarouselExit = useCallback((manualIdx) => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    pendingSlideIdxRef.current = manualIdx !== undefined ? manualIdx : null;
    setCarouselExiting(true);
  }, []);

  const onCarouselLoop = useCallback(() => {
    const t = Date.now();
    if (t - lastLoopAt.current < 400) return;
    lastLoopAt.current = t;
    if (exitingRef.current) return;
    if (skipNextAutoRef.current) {
      skipNextAutoRef.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSlideIdx((i) => (i + 1) % slides.length);
      return;
    }
    startCarouselExit();
  }, [startCarouselExit]);

  const pickSlide = useCallback(
    (idx) => {
      if (idx === slideIdx || exitingRef.current) return;
      skipNextAutoRef.current = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setSlideIdx(idx);
        setCarouselDeckKey((k) => k + 1);
        return;
      }
      startCarouselExit(idx);
    },
    [slideIdx, startCarouselExit]
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!mq.matches) return undefined;
    const id = window.setInterval(() => {
      setSlideIdx((i) => (i + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  /* Failsafe if animationend does not fire (tab background, etc.) */
  useEffect(() => {
    if (!carouselExiting) return undefined;
    const id = window.setTimeout(() => finishCarouselExit(), CAROUSEL_EXIT_MS + 200);
    return () => window.clearTimeout(id);
  }, [carouselExiting, finishCarouselExit]);

  return (
    <main>
      {/* Hero */}
      <section
        className="relative min-h-[480px] flex items-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%), url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-dark-900/60 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-xl">
            <div className="inline-block px-3 py-1 bg-accent-400/20 border border-accent-400/30 rounded-full mb-6">
              <span className="text-accent-400 text-xs font-semibold tracking-wider uppercase">Trusted since 2004</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
              You Break It,
              <br />
              <span className="text-accent-400">We Fix It!</span>
            </h1>
            <p className="mt-5 text-lg text-gray-300 leading-relaxed max-w-md">
              Expert repairs for your smartphone, laptop, and computer. Trusted by Woodbridge for over {new Date().getFullYear() - 2004} years.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="group px-7 py-3.5 bg-accent-400 text-dark-900 font-bold rounded-lg hover:bg-accent-300 transition-all duration-300 flex items-center gap-2"
              >
                Get in Touch
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/ticket"
                className="px-7 py-3.5 bg-white/10 text-white font-semibold rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-300 backdrop-blur-sm"
              >
                Track Your Repair
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 -mt-24 relative z-10">
            {[
              { icon: ShoppingBag, title: "Buy", desc: "Purchase the latest and expertly refurbished tech at great prices", color: "text-primary-500", bg: "bg-primary-50", border: "border-primary-100" },
              { icon: DollarSign, title: "Sell", desc: "Trade in your old or broken devices for top value", color: "text-accent-600", bg: "bg-accent-50", border: "border-accent-100" },
              { icon: Wrench, title: "Repair", desc: "Get reliable repairs for a wide range of tech devices", color: "text-primary-500", bg: "bg-primary-50", border: "border-primary-100" },
            ].map((card) => (
              <div
                key={card.title}
                className={`bg-white flex items-center gap-5 p-6 rounded-2xl border ${card.border} shadow-lg shadow-gray-100/50 hover:-translate-y-2 transition-all duration-500 group`}
              >
                <div className={`${card.bg} p-4 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon className={`w-8 h-8 ${card.color}`} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-bold text-dark-900 text-lg">{card.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Carousel: train + radar + copy; one row md+, stacked on small screens */}
      <section className="es-carousel-section py-7 md:py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-10 md:items-start md:gap-x-12">
            <div
              className={`relative z-0 overflow-visible md:pt-1 es-carousel-visual es-carousel-visual--${slides[slideIdx].size}`}
            >
              <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-visible px-3 sm:px-6 lg:px-12">
                <div className="es-carousel-scene mx-auto max-w-5xl">
                  <div
                    key={`${carouselDeckKey}-${slideIdx}`}
                    className={`relative w-full es-carousel-scene-inner es-carousel-scene-inner--${slides[slideIdx].size}`}
                  >
                    <span
                      className="es-carousel-cycle-ticker"
                      aria-hidden
                      onAnimationIteration={(e) => {
                        if (e.target !== e.currentTarget) return;
                        onCarouselLoop();
                      }}
                    />
                    <div className="es-carousel-train es-carousel-train-run">
                      <div
                        className={`es-carousel-device-wrap es-carousel-device-wrap--${slides[slideIdx].size}${
                          carouselExiting ? " es-carousel--exiting" : ""
                        }`}
                      >
                        <div
                          className={`es-carousel-device-stack${carouselExiting ? " es-carousel-device-stack--exit-run" : ""}`}
                        >
                          <div className="es-carousel-device">
                            <div className="es-carousel-bar-shell" aria-hidden>
                              <div className="es-carousel-bar es-carousel-bar-run" />
                            </div>
                            <div
                              className={`es-carousel-peek-ring es-carousel-peek-ring-run${
                                carouselExiting ? " es-carousel-peek-ring--exit-active" : ""
                              }`}
                              aria-hidden
                              onAnimationEnd={(e) => {
                                if (!carouselExiting || e.target !== e.currentTarget) return;
                                if (e.animationName !== "es-peek-ring-exit") return;
                                finishCarouselExit();
                              }}
                            />
                            <div className="es-carousel-peek-circle es-carousel-peek-circle-run" aria-hidden />
                            <img
                              src={slides[slideIdx].img}
                              alt={slides[slideIdx].alt}
                              className="h-full w-full max-h-full max-w-full object-contain object-center"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 md:z-30 min-w-0 flex flex-col md:pt-1 text-left">
              <div className="mb-8 flex flex-col gap-4 text-left min-h-[13.5rem] sm:min-h-[12rem] md:min-h-[17rem]">
                <div className="inline-flex self-start px-3 py-1 bg-primary-50 rounded-full">
                  <span className="text-primary-500 text-xs font-semibold tracking-wider uppercase">Our Services</span>
                </div>
                <div className="es-carousel-copy-wrap">
                  <div
                    key={`copy-${carouselDeckKey}-${slideIdx}`}
                    className="es-carousel-copy-anim es-carousel-copy-anim-run flex flex-col gap-3"
                  >
                    <h2 className="text-3xl font-extrabold text-dark-900 leading-tight">{slides[slideIdx].title}</h2>
                    <p className="text-gray-600 leading-relaxed text-base m-0 max-w-xl">{slides[slideIdx].desc}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {slides.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickSlide(i)}
                      className={`p-3 rounded-xl transition-all duration-300 ${
                        i === slideIdx
                          ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30 scale-110"
                          : "bg-white text-gray-400 border border-gray-200 hover:border-primary-300 hover:text-primary-500"
                      }`}
                    >
                      <Icon size={22} />
                    </button>
                  );
                })}
                <div className="flex-1" />
                <Link
                  to="/services"
                  className="text-sm text-primary-500 font-semibold hover:text-primary-600 transition-colors flex items-center gap-1 group"
                >
                  All Services
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Year Statement */}
      <section className="py-12 bg-gradient-to-r from-primary-600 to-primary-500 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="max-w-7xl mx-auto px-4 text-center relative">
          <p className="text-2xl sm:text-3xl font-bold text-white">
            Providing exceptional service for over{" "}
            <span className="text-accent-300 font-extrabold">{new Date().getFullYear() - 2004}</span>{" "}
            years
          </p>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-3 py-1 bg-accent-50 rounded-full mb-3">
              <span className="text-accent-600 text-xs font-semibold tracking-wider uppercase">Testimonials</span>
            </div>
            <h2 className="text-3xl font-extrabold text-dark-900">What Our Customers Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {reviews.map((r) => (
              <div key={r.name} className="p-6 rounded-2xl bg-gray-50 hover:bg-white border border-transparent hover:border-primary-100 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-500 group">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="text-accent-400 fill-accent-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4 italic">"{r.text}"</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-200/60">
                  <span className="text-sm font-bold text-dark-900">{r.name}</span>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-500 hover:underline">
                    Google Review
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brands */}
      <section className="py-14 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-10">We Service</p>
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-20">
            {[samsungLogo, hpLogo, appleLogo, googleLogo, lenovoLogo].map((logo, i) => (
              <img key={i} src={logo} alt="Brand" className="h-7 max-w-[120px] object-contain opacity-40 hover:opacity-100 transition-all duration-500 grayscale hover:grayscale-0" />
            ))}
          </div>
          <p className="mt-8 text-xs text-gray-400 tracking-wider">and more!</p>
        </div>
      </section>
    </main>
  );
}
