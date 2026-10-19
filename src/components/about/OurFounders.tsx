import React from 'react';
import { Target } from 'lucide-react';

interface Founder {
  name: string;
  role: string;
  initials: string;
  specialities: string;
  bio: string;
}

const FOUNDERS: Founder[] = [
  {
    name: 'Abdul Rehman Ansari',
    role: 'Co-founder & CTO',
    initials: 'AA',
    specialities: 'Technology, Product & Engineering',
    bio: "Leads Aashvo's technology, product direction, and engineering to make finding compatible flatmates and affordable accommodation simpler and more transparent.",
  },
  {
    name: 'Tushar Jaisawl',
    role: 'Co-founder & Head of Marketing',
    initials: 'TJ',
    specialities: 'Brand Strategy, Marketing & Growth',
    bio: "Leads Aashvo's brand positioning, marketing initiatives, and customer acquisition to help more students and professionals discover affordable shared living.",
  },
];

export const OurFounders: React.FC = () => {
  return (
    <section id="our-founders" className="py-14 sm:py-20 bg-ivory-100/50 border-t border-charcoal-200/40 scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700 bg-forest-50 px-3 py-1 rounded-full border border-forest-100">
            Leadership
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-charcoal-900 mt-2.5 tracking-tight">
            Our Founders
          </h2>
          <p className="text-sm text-charcoal-500 mt-2.5 leading-relaxed font-sans">
            Built by people who experienced the friction of finding safe, affordable, and dignified shared living in India&apos;s cities.
          </p>
        </div>

        {/* Founders Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {FOUNDERS.map(founder => (
            <div
              key={founder.name}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-charcoal-200/60 shadow-xs hover:border-forest-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Monogram & Title Header */}
                <div className="flex items-center space-x-3.5 mb-4">
                  <div className="w-13 h-13 rounded-xl bg-forest-800 text-sand-300 font-serif text-lg font-bold flex items-center justify-center flex-shrink-0 shadow-xs">
                    {founder.initials}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-charcoal-900 leading-snug">
                      {founder.name}
                    </h3>
                    <p className="text-xs font-bold text-forest-800 mt-0.5">
                      {founder.role}
                    </p>
                  </div>
                </div>

                {/* Specialities tag */}
                <div className="mb-3">
                  <span className="text-[11px] font-semibold text-charcoal-500 bg-ivory-100 px-2.5 py-1 rounded-md border border-charcoal-200/40">
                    {founder.specialities}
                  </span>
                </div>

                {/* Scannable Short Bio */}
                <p className="text-charcoal-600 text-xs sm:text-sm leading-relaxed">
                  {founder.bio}
                </p>
              </div>

              {/* Minimal Bottom Anchor */}
              <div className="mt-6 pt-3.5 border-t border-charcoal-100 flex items-center justify-between text-[11px] text-charcoal-400">
                <span>Aashvo Founding Team</span>
                <span>Pan-India Affordable Living</span>
              </div>
            </div>
          ))}
        </div>

        {/* Shared Mission Statement Card (Reduced to 1 concise statement) */}
        <div className="mt-8 sm:mt-10 bg-forest-900 text-ivory-100 rounded-2xl p-6 sm:p-7 border border-forest-800 text-center shadow-xs">
          <div className="flex items-center justify-center space-x-2 text-sand-300 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <Target className="w-3.5 h-3.5" />
            <span>Our Shared Mission</span>
          </div>
          <p className="font-serif text-base sm:text-lg text-white font-medium max-w-2xl mx-auto leading-relaxed">
            Making urban shared living affordable, communal, and transparent for students and working professionals across India.
          </p>
        </div>
      </div>
    </section>
  );
};
