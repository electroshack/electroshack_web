import React from "react";
import { Link } from "react-router-dom";
import { Smartphone, Tablet, Laptop, Monitor, Headphones, Cpu, Shield } from "lucide-react";

const services = [
  { icon: Smartphone, title: "Smartphone Repair", desc: "Screen replacements, battery swaps, charge port repairs, water damage restoration, and software troubleshooting for all major brands.", color: "bg-primary-50 text-primary-500" },
  { icon: Tablet, title: "Tablet Repair", desc: "Cracked screen repair, battery replacement, software fixes, and port repairs for iPads, Samsung Galaxy Tabs, and more.", color: "bg-accent-50 text-accent-600" },
  { icon: Laptop, title: "Laptop Repair", desc: "Screen and keyboard replacements, motherboard repair, data recovery, hard drive upgrades, and full diagnostics.", color: "bg-primary-50 text-primary-500" },
  { icon: Monitor, title: "PC Repair", desc: "Desktop diagnostics, component upgrades, virus removal, OS reinstallation, and custom PC builds.", color: "bg-accent-50 text-accent-600" },
  { icon: Headphones, title: "Accessories", desc: "Wide selection of cases, chargers, screen protectors, cables, and accessories for all your devices.", color: "bg-primary-50 text-primary-500" },
  { icon: Cpu, title: "Parts & Components", desc: "Quality replacement parts and components for DIY repairs or professional installation.", color: "bg-accent-50 text-accent-600" },
];

export default function Services() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-dark-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Our Services</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            From quick repairs to full device restoration, we've got you covered. All repairs come with a satisfaction guarantee.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) => (
              <div key={s.title} className="p-6 rounded-xl border border-gray-100 hover:border-primary-200 transition-all hover:-translate-y-1 duration-300 group">
                <div className={`inline-flex p-3 rounded-lg ${s.color} mb-4 group-hover:scale-110 transition-transform`}>
                  <s.icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-dark-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-dark-900 text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Bring It In", desc: "Drop off your device at our Woodbridge location" },
              { step: "02", title: "Diagnosis", desc: "We diagnose the issue and provide a transparent quote" },
              { step: "03", title: "Repair", desc: "Expert technicians fix your device with quality parts" },
              { step: "04", title: "Pick Up", desc: "Collect your fully restored device, good as new" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-500 text-white font-bold text-sm mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-dark-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="text-accent-300" size={28} />
            <h2 className="text-2xl font-bold text-white">Satisfaction Guaranteed</h2>
          </div>
          <p className="text-primary-100 mb-8 max-w-xl mx-auto">
            All repairs backed by our warranty. If you're not happy, we'll make it right.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/contact" className="px-6 py-3 bg-accent-400 text-dark-900 font-semibold rounded-lg hover:bg-accent-300 transition-colors">
              Get a Quote
            </Link>
            <Link to="/ticket" className="px-6 py-3 bg-white/10 text-white font-semibold rounded-lg border border-white/20 hover:bg-white/20 transition-colors">
              Track Your Repair
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
