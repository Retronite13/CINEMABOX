/**
 * LandingPage.jsx — CinemaBox
 *
 * Assumptions you may need to adjust to match your actual project:
 *  - Supabase client is imported from '../lib/supabaseClient' (named export `supabase`)
 *  - MoodGrid is imported from '../components/mood/MoodGrid' and accepts
 *    `moods` (array) + `onSelect(moodId)` props — update the import path and
 *    prop names to match your real MoodFinderPage component.
 *  - `movie_scores` view exposes: id, slug, title, director, genre, synopsis,
 *    poster_url, tier, percentage, rating_count, community_avg, created_at.
 *  - `movie_scores.order('random()')` isn't reliably supported by supabase-js,
 *    so "Movie of the Day" fetches a small pool of Legendary titles and picks
 *    one at random on the client instead.
 *
 * Requires react-router-dom (Link, useNavigate).
 */
import './LandingPage.css';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import MoodFinderPage from "./MoodFinderPage";


const NAV_TABS = [
  { id: 'movie-of-the-day', label: 'Movie of the Day', icon: '🎬' },
  { id: 'trending', label: 'Currently Trending', icon: '🔥' },
  { id: 'legendary', label: 'Legendary', icon: '👑' },
  { id: 'latest', label: 'Latest Releases', icon: '🆕' },
  { id: 'mood', label: 'Browse by Mood', icon: '🎭' },
  { id: 'community', label: 'Community Favorites', icon: '⭐' },
];

const isWithinDays = (dateString, days) => {
  if (!dateString) return false;
  const diffMs = Date.now() - new Date(dateString).getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
};

/* ------------------------------------------------------------------ */
/* Small reusable hooks                                                 */
/* ------------------------------------------------------------------ */

// Counts up from 0 to `target` once `start` becomes true.
function useCountUp(target, start, duration = 1600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf;
    let startTime = null;
    const tick = (timestamp) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration]);
  return value;
}

/* ------------------------------------------------------------------ */
/* Movie card                                                          */
/* ------------------------------------------------------------------ */

function MovieCard({ movie, variant }) {
  if (!movie) return null;
  const showNewBadge = variant === 'latest' && isWithinDays(movie.created_at, 7);

  return (
    <Link to={`/movie/${movie.slug}`} className="movie-card">
      <div className="card-poster-wrap">
        <img src={movie.poster_url} alt={movie.title} className="card-poster" loading="lazy" />
        {movie.tier && (
          <span className={`tier-badge tier-${movie.tier.toLowerCase()}`}>{movie.tier}</span>
        )}
        {showNewBadge && <span className="new-badge">NEW</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{movie.title}</h3>
        {variant === 'trending' && (
          <p className="card-meta">{movie.rating_count ?? 0} verdicts cast</p>
        )}
        {variant === 'legendary' && (
          <p className="card-meta">{movie.percentage}% approval</p>
        )}
        {variant === 'latest' && <p className="card-meta">{movie.genre}</p>}
        {variant === 'community' && (
          <p className="card-meta">
            <span className="card-meta-score">{Number(movie.community_avg ?? 0).toFixed(1)}</span>
            {' avg · '}
            {movie.rating_count ?? 0} reviewers
          </p>
        )}
      </div>
    </Link>
  );
}

function MovieRow({ movies, variant, emptyLabel }) {
  if (!movies || movies.length === 0) {
    return <p className="row-empty">{emptyLabel}</p>;
  }
  return (
    <div className="movie-row">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} variant={variant} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const navigate = useNavigate();

  // --- sticky nav ----------------------------------------------------
  const [isSticky, setIsSticky] = useState(false);
  const [activeTab, setActiveTab] = useState(NAV_TABS[0].id);
  const navRef = useRef(null);
  const [navHeight, setNavHeight] = useState(0);
  const sectionRefs = useRef({});

  useEffect(() => {
    const onScroll = () => setIsSticky(window.scrollY > 100);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (navRef.current) setNavHeight(navRef.current.offsetHeight);
  }, [isSticky]);

  const handleTabClick = useCallback((id) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const offset = 96; // clears the sticky nav
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  // Scroll-spy: whichever section sits nearest the top band becomes active.
  useEffect(() => {
    const targets = NAV_TABS.map((tab) => sectionRefs.current[tab.id]).filter(Boolean);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section-id');
            if (id) setActiveTab(id);
          }
        });
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // --- scroll-reveal for every section --------------------------------
  const [visible, setVisible] = useState({});
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-reveal-id]');
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-reveal-id');
            setVisible((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const revealClass = (id) => `reveal${visible[id] ? ' is-visible' : ''}`;

  // --- hero floating cards (generated once) ---------------------------
  const floatingCards = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => ({
        id: i,
        left: 6 + i * 13 + (i % 2 === 0 ? 2 : -3),
        duration: 20 + (i % 4) * 6,
        delay: -(i * 4.5),
        width: 110 + (i % 3) * 40,
        rotate: (i % 2 === 0 ? -1 : 1) * (3 + i * 2),
      })),
    []
  );

  // --- data ------------------------------------------------------------
  const [counts, setCounts] = useState({ movies: 0, ratings: 0, members: 0 });
  const [movieOfDay, setMovieOfDay] = useState(null);
  const [trending, setTrending] = useState([]);
  const [legendary, setLegendary] = useState([]);
  const [latest, setLatest] = useState([]);
  const [moods, setMoods] = useState([]);
  const [community, setCommunity] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      const [movies, ratings, members] = await Promise.all([
        supabase.from('movies').select('*', { count: 'exact', head: true }),
        supabase.from('ratings').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ]);
      if (cancelled) return;
      setCounts({
        movies: movies.count ?? 0,
        ratings: ratings.count ?? 0,
        members: members.count ?? 0,
      });
    }

    async function loadMovieOfDay() {
      const { data } = await supabase
        .from('movie_scores')
        .select('*')
        .eq('tier', 'Legendary')
        .limit(20);
      if (cancelled || !data || data.length === 0) return;
      setMovieOfDay(data[Math.floor(Math.random() * data.length)]);
    }

    async function loadTrending() {
      const { data } = await supabase
        .from('movie_scores')
        .select('*')
        .order('rating_count', { ascending: false })
        .limit(6);
      if (!cancelled && data) setTrending(data);
    }

    async function loadLegendary() {
      const { data } = await supabase
        .from('movie_scores')
        .select('*')
        .eq('tier', 'Legendary')
        .order('percentage', { ascending: false })
        .limit(6);
      if (!cancelled && data) setLegendary(data);
    }

    async function loadLatest() {
      const { data } = await supabase
        .from('movie_scores')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      if (!cancelled && data) setLatest(data);
    }

    async function loadMoods() {
      const { data } = await supabase.from('moods').select('*');
      if (!cancelled && data) setMoods(data);
    }

    async function loadCommunity() {
      const { data } = await supabase
        .from('movie_scores')
        .select('*')
        .gt('rating_count', 3)
        .order('community_avg', { ascending: false })
        .limit(6);
      if (!cancelled && data) setCommunity(data);
    }

    loadCounts();
    loadMovieOfDay();
    loadTrending();
    loadLegendary();
    loadLatest();
    loadMoods();
    loadCommunity();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalMovies = useCountUp(counts.movies, !!visible.stats);
  const totalRatings = useCountUp(counts.ratings, !!visible.stats);
  const totalMembers = useCountUp(counts.members, !!visible.stats);

  const handleMoodSelect = useCallback(
    (moodId) => navigate(`/mood?selected=${moodId}`),
    [navigate]
  );

  const registerSection = (id) => (el) => {
    sectionRefs.current[id] = el;
  };

  return (
    <main className="cinemabox-landing">
      {/* ---------------------------------------------------------- */}
      {/* 1. HERO                                                     */}
      {/* ---------------------------------------------------------- */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          {floatingCards.map((card) => (
            <div
              key={card.id}
              className="floating-card"
              style={{
                left: `${card.left}%`,
                width: `${card.width}px`,
                height: `${card.width * 1.5}px`,
                animationDuration: `${card.duration}s`,
                animationDelay: `${card.delay}s`,
                '--rotate': `${card.rotate}deg`,
              }}
            />
          ))}
        </div>

        <div className="hero-content">
          <h1 className="hero-title">CinemaBox</h1>
          <p className="hero-tagline">Every film. Every verdict. One community.</p>
          <div className="hero-ctas">
            <Link to="/movies" className="cta cta-primary">
              Explore Movies
            </Link>
            <Link to="/mood" className="cta cta-secondary">
              Find by Mood
            </Link>
          </div>
        </div>

        <button
          type="button"
          className="scroll-indicator"
          aria-label="Scroll down"
          onClick={() => handleTabClick('movie-of-the-day')}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 2. STICKY NAV TABS                                          */}
      {/* ---------------------------------------------------------- */}
      {isSticky && <div className="nav-spacer" style={{ height: navHeight }} />}
      <div ref={navRef} className={`nav-tabs-wrapper${isSticky ? ' is-sticky' : ''}`}>
        <nav className="nav-tabs" aria-label="Section navigation">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className="nav-tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="nav-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* 3. STATS COUNTER STRIP                                      */}
      {/* ---------------------------------------------------------- */}
      <section
        className={`stats-strip ${revealClass('stats')}`}
        data-reveal-id="stats"
      >
        <div className="stat">
          <span className="stat-value">{totalMovies.toLocaleString()}</span>
          <span className="stat-label">Films Catalogued</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalRatings.toLocaleString()}</span>
          <span className="stat-label">Verdicts Cast</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalMembers.toLocaleString()}</span>
          <span className="stat-label">Members</span>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 4. MOVIE OF THE DAY                                         */}
      {/* ---------------------------------------------------------- */}
      <section
        id="movie-of-the-day"
        data-section-id="movie-of-the-day"
        data-reveal-id="movie-of-the-day"
        ref={registerSection('movie-of-the-day')}
        className={`section motd-section ${revealClass('movie-of-the-day')}`}
      >
        <h2 className="section-title">
          <span aria-hidden="true">🎬</span> Movie of the Day
        </h2>

        {movieOfDay ? (
          <div className="motd-card">
            <div className="motd-poster">
              <img src={movieOfDay.poster_url} alt={movieOfDay.title} loading="lazy" />
            </div>
            <div className="motd-details">
              <span className={`tier-badge tier-${movieOfDay.tier?.toLowerCase()}`}>
                {movieOfDay.tier}
              </span>
              <h3 className="motd-name">{movieOfDay.title}</h3>
              <p className="motd-meta">
                {movieOfDay.director} · {movieOfDay.genre}
              </p>
              <p className="motd-synopsis">{movieOfDay.synopsis}</p>
              <div className="motd-footer">
                <span className="motd-score">{movieOfDay.percentage}%</span>
                <Link to={`/movie/${movieOfDay.slug}`} className="cta cta-primary">
                  View Film
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <p className="row-empty">Loading today's pick…</p>
        )}
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 5. CURRENTLY TRENDING                                       */}
      {/* ---------------------------------------------------------- */}
      <section
        id="trending"
        data-section-id="trending"
        data-reveal-id="trending"
        ref={registerSection('trending')}
        className={`section ${revealClass('trending')}`}
      >
        <h2 className="section-title">
          <span aria-hidden="true">🔥</span> Currently Trending
        </h2>
        <MovieRow movies={trending} variant="trending" emptyLabel="No trending films yet." />
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 6. LEGENDARY FILMS                                          */}
      {/* ---------------------------------------------------------- */}
      <section
        id="legendary"
        data-section-id="legendary"
        data-reveal-id="legendary"
        ref={registerSection('legendary')}
        className={`section legendary-section ${revealClass('legendary')}`}
      >
        <h2 className="section-title">
          <span aria-hidden="true">👑</span> Legendary
        </h2>
        <MovieRow movies={legendary} variant="legendary" emptyLabel="No legendary verdicts yet." />
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 7. LATEST RELEASES                                         */}
      {/* ---------------------------------------------------------- */}
      <section
        id="latest"
        data-section-id="latest"
        data-reveal-id="latest"
        ref={registerSection('latest')}
        className={`section ${revealClass('latest')}`}
      >
        <h2 className="section-title">
          <span aria-hidden="true">🆕</span> Latest Releases
        </h2>
        <MovieRow movies={latest} variant="latest" emptyLabel="Nothing new just yet." />
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 8. BROWSE BY MOOD                                          */}
      {/* ---------------------------------------------------------- */}
      <section
        id="mood"
        data-section-id="mood"
        data-reveal-id="mood"
        ref={registerSection('mood')}
        className={`section ${revealClass('mood')}`}
      >
        <h2 className="section-title">
          <span aria-hidden="true">🎭</span> Browse by Mood
        </h2>
        <MoodFinderPage moods={moods} onSelect={handleMoodSelect} />
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 9. COMMUNITY FAVORITES                                     */}
      {/* ---------------------------------------------------------- */}
      <section
        id="community"
        data-section-id="community"
        data-reveal-id="community"
        ref={registerSection('community')}
        className={`section ${revealClass('community')}`}
      >
        <h2 className="section-title">
          <span aria-hidden="true">⭐</span> Community Favorites
        </h2>
        <MovieRow movies={community} variant="community" emptyLabel="Not enough verdicts yet." />
      </section>

      {/* ---------------------------------------------------------- */}
      {/* 10. FOOTER                                                  */}
      {/* ---------------------------------------------------------- */}
      <footer className="footer">
        <span className="footer-logo">CinemaBox</span>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/movies">Explore Movies</Link>
          <Link to="/mood">Browse by Mood</Link>
          <Link to="/signup">Join CinemaBox</Link>
        </nav>
        <p className="footer-note">Built with ❤️ for cinema lovers</p>
      </footer>
    </main>
  );
}
