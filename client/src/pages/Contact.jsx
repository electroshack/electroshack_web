import React, { useState } from "react";
import { Phone, MapPin, Clock, Mail, Send } from "lucide-react";
import toast from "react-hot-toast";
import API from "../api";
import purolatorLogo from "../assets/purolator-logo.png";
import canparLogo from "../assets/canpar-logo.png";
import amazonLogo from "../assets/amazon-logo.png";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await API.post("/contact-forms", form);
      toast.success("Message sent! We'll get back to you soon.");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send message.");
    }
    setSending(false);
  };

  return (
    <main className="min-h-screen">
      {/* Map */}
      <section className="relative h-[350px] bg-gray-200">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2878.4795444393453!2d-79.6133481238141!3d43.825153871094344!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x882b244c42796e61%3A0x7e650ffad0e3e4cd!2sElectroshack!5e0!3m2!1sen!2sca!4v1724890485938!5m2!1sen!2sca"
          className="w-full h-full border-0"
          allowFullScreen=""
          loading="lazy"
          title="Electroshack Location"
        />
      </section>

      {/* Call */}
      <section className="py-10 bg-accent-400">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Phone size={22} className="text-dark-900" />
            <h2 className="text-xl font-bold text-dark-900">Call Directly</h2>
          </div>
          <a href="tel:905-893-1613" className="text-2xl font-bold text-dark-900 hover:underline">(905) 893-1613</a>
          <p className="text-dark-900/70 text-sm mt-1">The fastest way to get in contact!</p>
        </div>
      </section>

      {/* Info Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Location */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={20} className="text-primary-500" />
                <h3 className="text-lg font-semibold text-dark-900">Location</h3>
              </div>
              <p className="text-gray-600 font-medium">Woodbridge</p>
              <p className="text-gray-500 text-sm">9600 Islington Ave, Woodbridge, ON L4H 2T1</p>
            </div>

            {/* Hours */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={20} className="text-primary-500" />
                <h3 className="text-lg font-semibold text-dark-900">Hours</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600 font-medium">Monday &ndash; Friday</span><span className="text-gray-500">11am &ndash; 7pm</span></div>
                <div className="flex justify-between"><span className="text-gray-600 font-medium">Saturday</span><span className="text-gray-500">11am &ndash; 6pm</span></div>
                <div className="flex justify-between"><span className="text-gray-600 font-medium">Sunday</span><span className="text-gray-400">Closed</span></div>
              </div>
            </div>

            {/* Form */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Mail size={20} className="text-primary-500" />
                <h3 className="text-lg font-semibold text-dark-900">Get In Touch</h3>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Your name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Your email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <textarea
                  placeholder="Your message"
                  required
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center gap-2 px-5 py-2 bg-primary-500 text-white font-medium text-sm rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  <Send size={14} />
                  {sending ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Postal Partners */}
      <section className="py-12 bg-gray-50 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-8">Official Pickup & Dropoff Location for</p>
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-20">
          <img src={purolatorLogo} alt="Purolator" className="h-7 max-w-[120px] object-contain opacity-60 hover:opacity-100 transition-all duration-500" />
          <img src={canparLogo} alt="Canpar" className="h-7 max-w-[120px] object-contain opacity-60 hover:opacity-100 transition-all duration-500" />
          <img src={amazonLogo} alt="Amazon" className="h-7 max-w-[120px] object-contain opacity-60 hover:opacity-100 transition-all duration-500" />
        </div>
      </section>
    </main>
  );
}
