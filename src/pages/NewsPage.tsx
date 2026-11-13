import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  SparklesIcon,
  RefreshIcon,
  Calendar03Icon,
  Shield02Icon,
  ArrowRight01Icon,
} from 'hugeicons-react';

interface LotterySchedule {
  dayIndex: number; // 0 = Sunday, 1 = Monday, etc.
  dayName: string;
  name: string;
  code: string;
  firstPrize: string;
  ticketPrice: string;
  drawTime: string;
  description: string;
  color: string;
}

const WEEKLY_SCHEDULE: LotterySchedule[] = [
  {
    dayIndex: 0,
    dayName: 'Sunday',
    name: 'Akshaya',
    code: 'AK',
    firstPrize: '₹70 Lakhs',
    ticketPrice: '₹40',
    drawTime: '3:00 PM IST',
    description: 'Weekly Sunday draw by Kerala State Lotteries Department.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    dayIndex: 1,
    dayName: 'Monday',
    name: 'Win-Win',
    code: 'W',
    firstPrize: '₹75 Lakhs',
    ticketPrice: '₹40',
    drawTime: '3:00 PM IST',
    description: 'Premier Monday draw with ₹75,00,000 top jackpot.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    dayIndex: 2,
    dayName: 'Tuesday',
    name: 'Sthree Sakthi',
    code: 'SS',
    firstPrize: '₹75 Lakhs',
    ticketPrice: '₹40',
    drawTime: '3:00 PM IST',
    description: 'Tuesday draw dedicated to women empowerment programs.',
    color: 'from-pink-500 to-rose-600',
  },
  {
    dayIndex: 3,
    dayName: 'Wednesday',
    name: 'Fifty-Fifty',
    code: 'FF',
    firstPrize: '₹1 Crore',
    ticketPrice: '₹50',
    drawTime: '3:00 PM IST',
    description: 'Mid-week mega jackpot with ₹1,00,00,000 top prize.',
    color: 'from-purple-500 to-indigo-600',
  },
  {
    dayIndex: 4,
    dayName: 'Thursday',
    name: 'Karunya Plus',
    code: 'KN',
    firstPrize: '₹80 Lakhs',
    ticketPrice: '₹40',
    drawTime: '3:00 PM IST',
    description: 'Weekly Thursday draw supporting Kerala medical welfare.',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    dayIndex: 5,
    dayName: 'Friday',
    name: 'Nirmal',
    code: 'NR',
    firstPrize: '₹70 Lakhs',
    ticketPrice: '₹40',
    drawTime: '3:00 PM IST',
    description: 'Friday draw funding environmental & clean sanitation initiatives.',
    color: 'from-teal-500 to-emerald-600',
  },
  {
    dayIndex: 6,
    dayName: 'Saturday',
    name: 'Karunya',
    code: 'KR',
    firstPrize: '₹80 Lakhs',
    ticketPrice: '₹40',
    drawTime: '3:00 PM IST',
    description: 'Weekend draw dedicated to healthcare and benevolent medical aid.',
    color: 'from-rose-500 to-red-600',
  },
];

interface StreamChannel {
  id: string;
  name: string;
  tag: string;
  badge: string;
  embedUrl: string;
  youtubeChannelUrl: string;
}

const CHANNELS: StreamChannel[] = [
  {
    id: 'kslott',
    name: 'Kerala State Lottery Official',
    tag: '@kslott',
    badge: 'Official 3:00 PM Live Draw',
    // Live search / channel embed
    embedUrl: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC4g1cT4p4uB_w16B5L4bH9w',
    youtubeChannelUrl: 'https://www.youtube.com/@kslott',
  },
  {
    id: 'asianet',
    name: 'Asianet News Malayalam',
    tag: '24/7 Live Stream',
    badge: 'Results & Breaking News',
    embedUrl: 'https://www.youtube-nocookie.com/embed/5_nZ3LpDfgA?autoplay=0',
    youtubeChannelUrl: 'https://www.youtube.com/@asianetnews',
  },
  {
    id: 'twentyfour',
    name: '24 News Live Kerala',
    tag: 'Live Results Bulletin',
    badge: 'Daily 3 PM Coverage',
    embedUrl: 'https://www.youtube-nocookie.com/embed/coEw7Xg_h9I?autoplay=0',
    youtubeChannelUrl: 'https://www.youtube.com/@24NewsLive',
  },
  {
    id: 'manorama',
    name: 'Manorama News',
    tag: 'Kerala News Live',
    badge: 'Daily Results',
    embedUrl: 'https://www.youtube-nocookie.com/embed/Xm_sXUeFvD4?autoplay=0',
    youtubeChannelUrl: 'https://www.youtube.com/@manoramanews',
  },
];

export const NewsPage: React.FC = () => {
  const [selectedChannel, setSelectedChannel] = useState<StreamChannel>(CHANNELS[0]);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [nowDate, setNowDate] = useState<Date>(new Date());

  useEffect(() => {
    // Update live clock every minute
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Format today's date in Indian Standard Time (IST)
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const todayFormatted = istFormatter.format(nowDate);

  // Get IST day of week (0 = Sunday ... 6 = Saturday)
  const istDayFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'narrow',
  });
  const istDateObj = new Date(
    nowDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const currentDayIndex = istDateObj.getDay();
  const currentHour = istDateObj.getHours();
  const currentMinute = istDateObj.getMinutes();

  // Determine current draw status
  const isDrawLive =
    currentHour === 15 && currentMinute >= 0 && currentMinute <= 45;
  const isDrawUpcoming = currentHour < 15;
  const isDrawFinished =
    currentHour > 15 || (currentHour === 15 && currentMinute > 45);

  const todaysLottery =
    WEEKLY_SCHEDULE.find((s) => s.dayIndex === currentDayIndex) ||
    WEEKLY_SCHEDULE[0];

  const handleRefreshPlayer = () => {
    setIframeKey(Date.now());
  };

  return (
    <div className="relative min-h-screen bg-[#f8f7ff] dark:bg-[#07060d] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-tr from-rose-500/10 via-red-500/15 to-amber-500/10 blur-[130px] rounded-full" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Top Breadcrumb & Live Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Link to="/" className="hover:text-red-500 transition">
              Home
            </Link>
            <span>/</span>
            <span className="text-neutral-800 dark:text-neutral-200 font-semibold">
              Kerala Results & Daily News
            </span>
          </div>

          {/* Today's IST Date & Live Badge */}
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>
                {isDrawLive
                  ? 'LIVE DRAW IN PROGRESS'
                  : isDrawUpcoming
                  ? 'DRAW TODAY AT 3:00 PM IST'
                  : 'TODAY’S RESULTS ANNOUNCED'}
              </span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <Calendar03Icon size={14} className="text-red-500" />
              <span>{todayFormatted}</span>
            </div>
          </div>
        </div>

        {/* Hero Section Header */}
        <div className="mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
            <span>🔴 Kerala Results Live Bulletin</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-neutral-900 dark:text-white">
            Kerala State Lottery Results &{' '}
            <span className="bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 bg-clip-text text-transparent">
              Live YouTube Broadcast
            </span>
          </h1>
          <p className="max-w-2xl text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Watch live daily Kerala lottery draws at 3:00 PM IST broadcasted direct from Gorky Bhavan, Thiruvananthapuram. Verified winning numbers, prize breakdowns, and daily updates.
          </p>
        </div>

        {/* Main Grid: Video Stream Player (Left) + Today's Draw Card (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          {/* Left Column: Responsive Video Player (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            {/* Channel Selection Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {CHANNELS.map((ch) => {
                const isActive = ch.id === selectedChannel.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedChannel(ch);
                      setIframeKey(Date.now());
                    }}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                        : 'bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:border-red-500/40'
                    }`}
                  >
                    <span>{ch.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        isActive
                          ? 'bg-black/25 text-white'
                          : 'bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {ch.tag}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Video Player Frame with Glassmorphism Frame */}
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-neutral-200 dark:border-white/10 bg-black shadow-2xl group">
              {/* 16:9 Aspect Ratio Container */}
              <div className="relative w-full pb-[56.25%] bg-black">
                <iframe
                  key={iframeKey}
                  src={selectedChannel.embedUrl}
                  title={`${selectedChannel.name} - Kerala Results Live Broadcast`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>

              {/* Bottom Control Bar on Video Frame */}
              <div className="flex items-center justify-between p-3 sm:p-4 bg-neutral-900/95 backdrop-blur-md border-t border-white/10 text-white text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold text-white leading-tight">
                    {selectedChannel.name}
                  </span>
                  <span className="hidden sm:inline text-neutral-400">
                    • {selectedChannel.badge}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshPlayer}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-semibold text-white transition cursor-pointer active:scale-95"
                    title="Reload video stream"
                  >
                    <RefreshIcon size={13} />
                    <span>Refresh</span>
                  </button>

                  <a
                    href={selectedChannel.youtubeChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1 text-xs font-bold text-white shadow-sm transition active:scale-95"
                  >
                    <span>Watch on YouTube</span>
                    <ArrowRight01Icon size={13} />
                  </a>
                </div>
              </div>
            </div>

            {/* Live Ticker / Notification */}
            <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-md p-4 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-sm font-black">
                  📢
                </span>
                <div>
                  <strong className="text-neutral-900 dark:text-white block font-bold">
                    Official Draw Notice:
                  </strong>
                  Live draws are held daily at 3:00 PM at Gorky Bhavan, Thiruvananthapuram in presence of a panel of judges.
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Today's Featured Draw (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Today's Draw Highlight Card */}
            <div className="relative rounded-3xl overflow-hidden border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#0f0e1c] p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                  <span>Today’s Draw</span>
                </div>
                <span className="text-xs font-bold text-neutral-400">
                  {todaysLottery.dayName}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                  {todaysLottery.name} Lottery
                </h2>
                <span className="text-xs font-mono font-bold text-red-500">
                  Draw Code: {todaysLottery.code}
                </span>
              </div>

              {/* Prize Highlight Box */}
              <div className="rounded-2xl bg-gradient-to-br from-red-600/10 via-rose-500/10 to-amber-500/10 border border-red-500/20 p-4 space-y-1">
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                  1st Prize Jackpot
                </span>
                <span className="text-3xl font-black bg-gradient-to-r from-red-600 to-amber-500 bg-clip-text text-transparent">
                  {todaysLottery.firstPrize}
                </span>
                <span className="text-[10px] text-neutral-400 block pt-1">
                  Ticket price: {todaysLottery.ticketPrice} per ticket
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.06]">
                  <span className="text-neutral-500">Live Draw Start:</span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    {todaysLottery.drawTime}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.06]">
                  <span className="text-neutral-500">Result Published:</span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    4:00 PM IST
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-white/[0.06]">
                  <span className="text-neutral-500">Draw Venue:</span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    Gorky Bhavan, TVM
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-neutral-500">Consolation Prize:</span>
                  <span className="font-bold text-emerald-500">₹8,000</span>
                </div>
              </div>

              <a
                href="https://statelottery.kerala.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 p-3 text-xs font-black text-white shadow-lg shadow-red-600/30 transition active:scale-95"
              >
                <span>Verify Official Gazette PDF</span>
                <ArrowRight01Icon size={14} />
              </a>
            </div>

            {/* Quick Live Video Chat Callout */}
            <div className="rounded-3xl border border-neutral-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-md p-5 space-y-3">
              <div className="flex items-center gap-2">
                <SparklesIcon size={16} className="text-red-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                  Chat Live on U-R-LIVE
                </h3>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Meet verified people across Kerala and around the globe with peer-to-peer live video.
              </p>
              <Link
                to="/live"
                className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black font-bold text-xs px-3.5 py-2 hover:opacity-90 transition active:scale-95"
              >
                <span>Start Video Chat</span>
                <ArrowRight01Icon size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* Weekly Draw Schedule Grid */}
        <div className="space-y-4 mb-14">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                Kerala Weekly Lottery Schedule
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                Official draw calendar updated for every day of the week.
              </p>
            </div>
            <div className="text-xs font-mono font-semibold text-neutral-400">
              Draw Time: 3:00 PM Every Day
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {WEEKLY_SCHEDULE.map((item) => {
              const isToday = item.dayIndex === currentDayIndex;
              return (
                <div
                  key={item.code}
                  className={`relative rounded-2xl p-4 flex flex-col justify-between transition-all ${
                    isToday
                      ? 'border-2 border-red-500 bg-red-500/[0.05] shadow-lg shadow-red-500/10 scale-[1.02]'
                      : 'border border-neutral-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03]'
                  }`}
                >
                  {isToday && (
                    <div className="absolute -top-2.5 right-3 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow">
                      Today
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {item.dayName}
                    </span>
                    <h4 className="text-base font-black text-neutral-900 dark:text-white leading-tight">
                      {item.name}
                    </h4>
                    <span className="text-[10px] font-mono font-semibold text-red-500 block">
                      Code: {item.code}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/[0.06] space-y-0.5">
                    <span className="text-[10px] text-neutral-500 block">1st Prize</span>
                    <span className="text-sm font-black text-neutral-900 dark:text-white block">
                      {item.firstPrize}
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Ticket: {item.ticketPrice}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Verification & Claim Guide Section */}
        <div className="rounded-3xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#0c0b16] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <Shield02Icon size={20} className="text-emerald-500" />
            <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
              Official Prize Claim & Ticket Verification Rules
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/[0.06]">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-500/10 text-red-500 font-black text-sm">
                1
              </span>
              <h5 className="font-bold text-neutral-900 dark:text-white text-sm">
                Cross-Check Gazette
              </h5>
              <p>
                Winning numbers announced live must be verified against the official Kerala Government Gazette published at{' '}
                <a
                  href="https://statelottery.kerala.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 underline"
                >
                  statelottery.kerala.gov.in
                </a>.
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/[0.06]">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 font-black text-sm">
                2
              </span>
              <h5 className="font-bold text-neutral-900 dark:text-white text-sm">
                30-Day Claim Window
              </h5>
              <p>
                Prize-winning tickets must be surrendered within 30 days from the date of the draw with signature, name, address, and valid Aadhaar / PAN card proof.
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/[0.06]">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 font-black text-sm">
                3
              </span>
              <h5 className="font-bold text-neutral-900 dark:text-white text-sm">
                Prizes & Bank Deposit
              </h5>
              <p>
                Prizes up to ₹1 Lakh can be claimed at any District Lottery Office. Prizes above ₹1 Lakh must be claimed through Nationalized or Scheduled Banks.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-neutral-500 border-t border-neutral-100 dark:border-white/[0.06] pt-4 leading-relaxed">
            <strong>Disclaimer:</strong> This page embeds live news and broadcast video streams from YouTube for informational purposes. U-R-LIVE does not sell lottery tickets or conduct lotteries. Please verify all lottery results through the official Directorate of Kerala State Lotteries gazette.
          </div>
        </div>
      </div>
    </div>
  );
};
