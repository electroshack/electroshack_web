import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Search } from "lucide-react";
import logo from "../assets/hero_logo2.png";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const links = [
    { to: "/", label: "Home" },
    { to: "/services", label: "Services" },
    { to: "/shop", label: "Shop" },
    { to: "/contact", label: "Contact" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-dark-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex-shrink-0 flex items-center">
            <img src={logo} alt="Electroshack" className="h-14 sm:h-16 w-auto drop-shadow-[0_0_18px_rgba(7,135,236,0.25)]" />
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? "text-accent-400 bg-dark-800"
                    : "text-gray-300 hover:text-white hover:bg-dark-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-3">
            <Link
              to="/ticket"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white text-sm font-medium rounded-full hover:bg-primary-600 transition-colors"
            >
              <Search size={14} />
              Track Repair
            </Link>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-gray-300 hover:text-white p-2"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-dark-900 border-t border-dark-800">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive(link.to)
                    ? "text-accent-400 bg-dark-800"
                    : "text-gray-300 hover:text-white hover:bg-dark-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/ticket"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                isActive("/ticket")
                  ? "text-white bg-primary-600"
                  : "text-white bg-primary-500 hover:bg-primary-600"
              }`}
            >
              <Search size={16} />
              Track Repair
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
