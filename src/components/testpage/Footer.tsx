'use client';

import { MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0B2818] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold">placemaker.ai</span>
            </div>
            <p className="text-gray-400 text-sm text-center md:text-left">
              Digital tools for public consultations.
            </p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2">
            <a
              href="https://platform.placemakerai.io/login"
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Client sign in
            </a>
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Placemaker. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
