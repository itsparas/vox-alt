import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-secondary-900 dark:via-secondary-950 dark:to-secondary-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-secondary-900/80 backdrop-blur-lg border-b border-secondary-200 dark:border-secondary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-xl font-bold text-secondary-900 dark:text-white">
                VoxReception
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-secondary-600 hover:text-secondary-900 dark:text-secondary-400 dark:hover:text-white font-medium"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="btn-primary px-4 py-2 rounded-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-secondary-900 dark:text-white mb-6">
            Your AI Receptionist,{' '}
            <span className="text-gradient">Always Available</span>
          </h1>
          <p className="text-xl text-secondary-600 dark:text-secondary-400 max-w-3xl mx-auto mb-8">
            Never miss a call again. VoxReception handles calls 24/7, books appointments,
            answers questions, and escalates when needed - all powered by advanced AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="btn-primary px-8 py-4 text-lg rounded-xl"
            >
              Start Free Trial
            </Link>
            <Link
              href="#demo"
              className="btn-secondary px-8 py-4 text-lg rounded-xl"
            >
              Watch Demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-secondary-500">
            No credit card required • 14-day free trial
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white dark:bg-secondary-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-secondary-900 dark:text-white mb-12">
            Everything You Need
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border border-secondary-200 dark:border-secondary-700">
              <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">
                24/7 Call Handling
              </h3>
              <p className="text-secondary-600 dark:text-secondary-400">
                Never miss a call. Your AI receptionist answers every call, day or night,
                with natural conversation.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-secondary-200 dark:border-secondary-700">
              <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">
                Smart Scheduling
              </h3>
              <p className="text-secondary-600 dark:text-secondary-400">
                Automatically book appointments with Google Calendar integration.
                Check availability in real-time.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-secondary-200 dark:border-secondary-700">
              <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">
                Human Escalation
              </h3>
              <p className="text-secondary-600 dark:text-secondary-400">
                Seamlessly transfer complex calls to your team with full context
                and real-time transcription.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-secondary-900 dark:text-white mb-4">
            Ready to transform your reception?
          </h2>
          <p className="text-xl text-secondary-600 dark:text-secondary-400 mb-8">
            Join thousands of businesses using VoxReception to never miss a call again.
          </p>
          <Link
            href="/register"
            className="btn-primary px-8 py-4 text-lg rounded-xl inline-block"
          >
            Start Your Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-secondary-200 dark:border-secondary-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="font-semibold text-secondary-900 dark:text-white">
                VoxReception
              </span>
            </div>
            <div className="flex gap-6 text-sm text-secondary-600 dark:text-secondary-400">
              <Link href="/privacy" className="hover:text-secondary-900 dark:hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-secondary-900 dark:hover:text-white">
                Terms of Service
              </Link>
              <Link href="/contact" className="hover:text-secondary-900 dark:hover:text-white">
                Contact
              </Link>
            </div>
            <p className="text-sm text-secondary-500">
              © 2024 VoxReception. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
