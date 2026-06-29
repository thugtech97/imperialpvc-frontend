import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Head from "next/head";
import { getPublicPageBySlug, PublicAlbum, PublicPage } from "@/services/publicPageService";
import { getPublicArticles } from "@/services/articleService";
import LandingPageLayout from "@/components/Layout/GuestLayout";
import CmsHtmlBlock from "@/components/Layout/CmsHtmlBlock";
import { prepareHomePageCms } from "@/lib/prepareHomePageCms";
import type { PreparedHomeCms } from "@/lib/prepareHomePageCms";
export const BANNER_TITLE = "Imperial PVC";

export async function getServerSideProps(context: { res: { setHeader: (name: string, value: string) => void } }) {
    context.res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    context.res.setHeader("Pragma", "no-cache");
    context.res.setHeader("Expires", "0");

    try {
        const [pageRes, articlesRes] = await Promise.all([
            getPublicPageBySlug("home"),
            getPublicArticles({ per_page: 3 }),
        ]);

        let products: any[] = [];

        const pageData = pageRes.data ?? null;
        const cms = prepareHomePageCms(pageData);

        return {
            props: {
                pageData,
                news: articlesRes.data?.data ?? [],
                products,
                middleCmsHtml: cms.middleCmsHtml,
                testimonialsHtml: cms.testimonialsHtml,
                pageStyles: cms.pageStyles,
            },
        };
    } catch (error) {
        console.error("Error fetching page data:", error);
        return { notFound: true };
    }
}

interface LandingPageLayoutProps {
  children?: React.ReactNode;
  pageData?: PublicPage;
  news?: any[];
  products?: any[];
  middleCmsHtml?: string;
  testimonialsHtml?: string;
  pageStyles?: string;  layout?: {
    fullWidth?: boolean;
  };
}

type Slide = {
    image: string;
    title: string;
    desc: string;
};

function Slider({ slides }: { slides: Slide[] }) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setIndex(i => (i + 1) % slides.length), 4000);
        return () => clearInterval(id);
    }, [slides.length]);

    const prev = () => setIndex(i => (i - 1 + slides.length) % slides.length);
    const next = () => setIndex(i => (i + 1) % slides.length);

    return (
        <div className="slider-root">
            <div className="slide d-flex align-items-center">
                <div className="slide-image" style={{ width: '60%' }}>
                    <img src={slides[index].image} alt={slides[index].title} className="img-fluid" />
                </div>
                <div className="slide-info p-4" style={{ width: '40%' }}>
                    <h3 className="fs-3 fw-bold">{slides[index].title}</h3>
                    <p className="fs-6 text-secondary">{slides[index].desc}</p>
                    <div>
                        <a href="/public/news" className="btn btn-danger mt-4 w-20">Learn More</a>
                    </div>
                </div>
            </div>

            <button aria-label="Previous" onClick={prev} className="nav-button prev">‹</button>
            <button aria-label="Next" onClick={next} className="nav-button next">›</button>

            <div className="indicators mt-3 text-center">
                {slides.map((_, i) => (
                    <span key={i} onClick={() => setIndex(i)} className={`indicator ${i === index ? 'active' : ''}`}></span>
                ))}
            </div>

            <style jsx>{`
                .slider-root { position: relative; max-width: 1280px; margin: 0 auto; }
                .slide { gap: 20px; }
                .slide-image img { width: 100%; height: 360px; object-fit: cover; border-radius: 8px; }
                .slide-info { display: flex; flex-direction: column; justify-content: center; }
                .nav-button { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.45); color: #fff; border: none; padding: 8px 12px; font-size: 20px; border-radius: 6px; cursor: pointer; padding-top: 4px; }
                .nav-button.prev { left: 8px; }
                .nav-button.next { right: 8px; }
                .indicators { display:flex; justify-content:center; gap:8px; }
                .indicator { width:10px; height:10px; border-radius:50%; background:#ddd; display:inline-block; cursor:pointer; }
                .indicator.active { background:#ff7b00; }
                @media(max-width: 768px) {
                    .slide { flex-direction: column; }
                    .slide-image img { height: 220px; }
                    .slide-image, .slide-info { width: 100% !important; }
                }
            `}</style>
        </div>
    );
}

/** Initializes the GrapesJS testimonials carousel (3 cards per slide on desktop). */
function initHomeTestimonialsCarousel(root: HTMLElement): () => void {
    const GAP = 24;

    const getNodes = () => {
        const track = root.querySelector("#tsTrack") as HTMLElement | null;
        const viewport = root.querySelector("#tsViewport") as HTMLElement | null;
        const dotsWrap = root.querySelector("#tsDots") as HTMLElement | null;
        const slots = track
            ? (Array.from(track.querySelectorAll(".ts-slot")) as HTMLElement[])
            : [];

        return { track, viewport, dotsWrap, slots };
    };

    let slide = 0;
    let ipv = 3;
    let timer: ReturnType<typeof setInterval> | null = null;
    let running = false;
    let rafId = 0;

    const getIPV = () => (window.innerWidth >= 768 ? 3 : 1);

    const getCardW = (viewport: HTMLElement) => {
        const vw = viewport.clientWidth;
        if (vw <= 0) return 0;
        return (vw - GAP * (ipv - 1)) / ipv;
    };

    const render = () => {
        const { track, viewport, dotsWrap, slots } = getNodes();
        if (!track || !viewport || !dotsWrap || !slots.length) return;

        const cardW = getCardW(viewport);
        if (cardW <= 0) return;

        slots.forEach((slot) => {
            slot.style.width = `${cardW}px`;
        });

        const step = ipv * (cardW + GAP);
        track.style.transform = `translateX(-${slide * step}px)`;

        dotsWrap.querySelectorAll(".ts-dot").forEach((dot, index) => {
            dot.classList.toggle("active", index === slide);
        });
    };

    const buildDots = () => {
        const { dotsWrap, slots } = getNodes();
        if (!dotsWrap || !slots.length) return;

        const groups = Math.ceil(slots.length / ipv);
        dotsWrap.innerHTML = "";

        for (let i = 0; i < groups; i += 1) {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = `ts-dot${i === slide ? " active" : ""}`;
            dot.setAttribute("aria-label", `Slide ${i + 1}`);
            dot.dataset.slideIndex = String(i);
            dotsWrap.appendChild(dot);
        }
    };

    const goNext = () => {
        const { slots } = getNodes();
        if (!slots.length) return;

        const groups = Math.ceil(slots.length / ipv);
        if (groups <= 1) return;

        slide = (slide + 1) % groups;
        render();
    };

    const goPrev = () => {
        const { slots } = getNodes();
        if (!slots.length) return;

        const groups = Math.ceil(slots.length / ipv);
        if (groups <= 1) return;

        slide = (slide - 1 + groups) % groups;
        render();
    };

    const stopTimer = () => {
        running = false;
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    };

    const startTimer = () => {
        const { slots } = getNodes();
        if (!slots.length) return;

        const groups = Math.ceil(slots.length / ipv);
        if (groups <= 1) return;

        if (running) return;
        running = true;
        timer = setInterval(goNext, 4500);
    };

    const resetTimer = () => {
        stopTimer();
        startTimer();
    };

    const boot = () => {
        const { viewport, slots } = getNodes();
        if (!viewport || !slots.length) return;

        if (viewport.clientWidth <= 0) {
            rafId = window.requestAnimationFrame(boot);
            return;
        }

        ipv = getIPV();
        slide = 0;
        buildDots();
        render();
        startTimer();
    };

    const onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (target.closest("#tsPrev, .ts-arrow-prev")) {
            event.preventDefault();
            goPrev();
            resetTimer();
            return;
        }

        if (target.closest("#tsNext, .ts-arrow-next")) {
            event.preventDefault();
            goNext();
            resetTimer();
            return;
        }

        const dot = target.closest(".ts-dot") as HTMLElement | null;
        if (dot && dot.dataset.slideIndex !== undefined) {
            event.preventDefault();
            slide = Number(dot.dataset.slideIndex);
            render();
            resetTimer();
        }
    };

    const onResize = () => {
        const newIPV = getIPV();
        if (newIPV !== ipv) {
            ipv = newIPV;
            slide = 0;
            buildDots();
        }
        render();
    };

    const onMouseEnter = () => stopTimer();
    const onMouseLeave = () => startTimer();

    root.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);

    const { viewport } = getNodes();
    if (viewport) {
        viewport.addEventListener("mouseenter", onMouseEnter);
        viewport.addEventListener("mouseleave", onMouseLeave);
    }

    rafId = window.requestAnimationFrame(boot);

    return () => {
        window.cancelAnimationFrame(rafId);
        stopTimer();
        root.removeEventListener("click", onClick);
        window.removeEventListener("resize", onResize);
        const nodes = getNodes();
        if (nodes.viewport) {
            nodes.viewport.removeEventListener("mouseenter", onMouseEnter);
            nodes.viewport.removeEventListener("mouseleave", onMouseLeave);
        }
    };
}

export default function Home({
    pageData,
    news,
    products = [],
    middleCmsHtml: initialMiddleCmsHtml = "",
    testimonialsHtml: initialTestimonialsHtml = "",
    pageStyles: initialPageStyles = "",
}: LandingPageLayoutProps) {
    const testimonialsRef = useRef<HTMLDivElement>(null);
    const [clientProducts, setClientProducts] = useState<any[]>(products);
    const [cmsContent, setCmsContent] = useState<PreparedHomeCms>({
        middleCmsHtml: initialMiddleCmsHtml,
        testimonialsHtml: initialTestimonialsHtml,
        pageStyles: initialPageStyles,
    });

    const { middleCmsHtml, testimonialsHtml, pageStyles } = cmsContent;

    // Always refresh CMS content from the API on the client so Vercel shows latest GrapesJS saves.
    useEffect(() => {
        let cancelled = false;

        getPublicPageBySlug("home")
            .then((res) => {
                if (cancelled || !res.data) return;
                setCmsContent(prepareHomePageCms(res.data));
            })
            .catch((err) => {
                console.error("Failed to refresh home CMS content", err);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // If SSR didn't supply any products, try fetching on the client
    useEffect(() => {
        if (clientProducts && clientProducts.length) return;
        let cancelled = false;

        const extractArray = (payload: any): any[] => {
            if (!payload) return [];
            let data: any = payload?.data ?? payload;
            if (data && typeof data === "object" && !Array.isArray(data) && "data" in data) {
                data = (data as any).data;
                if (data && typeof data === "object" && !Array.isArray(data) && "data" in data) {
                    data = (data as any).data;
                }
            }
            if (Array.isArray(data)) return data;
            const candidates = [
                (data as any)?.items,
                (data as any)?.rows,
                (data as any)?.results,
                (data as any)?.result,
                (data as any)?.products,
                (data as any)?.categories,
                (data as any)?.product_categories,
                (data as any)?.productCategories,
                (data as any)?.productCategory,
            ];
            for (const c of candidates) {
                if (Array.isArray(c)) return c;
                if (c && typeof c === "object" && Array.isArray((c as any).data)) return (c as any).data;
            }
            return [];
        };

        const fetchClient = async () => {
            try {
                const { axiosInstance } = await import("@/services/axios");
                const eps = ["/public-products"];
                for (const ep of eps) {
                    try {
                        const resp = await axiosInstance.get(ep, { params: { per_page: 4 }, headers: { "X-No-Loading": true } });
                        const arr = extractArray(resp.data);
                        if (arr && arr.length) {
                            if (!cancelled) setClientProducts(arr.slice(0, 4));
                            break;
                        }
                    } catch {
                        // continue to next endpoint
                    }
                }
            } catch {
                // ignore
            }
        };

        fetchClient();
        return () => { cancelled = true; };
    }, [clientProducts]);

    const descriptors = ["Modern", "Real Estate", "Business"];
    const [descIndex, setDescIndex] = useState(0);

    useEffect(() => {
        const id = setInterval(() => {
            setDescIndex(i => (i + 1) % descriptors.length);
        }, 2500);
        return () => clearInterval(id);
    }, []);

    useLayoutEffect(() => {
        if (!testimonialsHtml.trim() || !testimonialsRef.current) return;

        let cleanup: (() => void) | undefined;
        const timers: ReturnType<typeof setTimeout>[] = [];

        const boot = () => {
            cleanup?.();
            if (!testimonialsRef.current) return;
            cleanup = initHomeTestimonialsCarousel(testimonialsRef.current);
        };

        boot();
        [150, 500, 1200].forEach((delay) => {
            timers.push(setTimeout(boot, delay));
        });

        return () => {
            timers.forEach(clearTimeout);
            cleanup?.();
        };
    }, [testimonialsHtml]);

    return (
        <div>
            {pageStyles ? (
                <Head>
                    <style
                        id="home-page-cms-styles"
                        dangerouslySetInnerHTML={{ __html: pageStyles }}
                    />
                </Head>
            ) : null}

            <div className="w-100 base-content">

                {/* ── Products Section ── */}
                <div className="container py-5 text-center cutter-section">

                    <div className="heading-block text-center border-0" data-heading="P">
                        <h2 className="fs-1 fw-bold">Our Products</h2>
                    </div>

                    <div className="w-100 cutter-title">
                        <p className="fs-5 fw-light text-secondary py-3 w-50 text-center mx-auto">
                            Imperial PVC delivers durable, high-quality PVC solutions engineered for strength, style, and long-lasting performance.
                            Designed for{" "}
                            <span id="description-animate" aria-live="polite" style={{ color: '#ff7b00' }}>
                                {descriptors[descIndex]}
                            </span>{" "}
                            construction and everyday reliability.
                        </p>
                    </div>

                    <div className="w-100 products-container-lines">
                        <div className="d-flex flex-column flex-md-row flex-md-wrap flex-lg-nowrap gap-4 justify-content-center">
                            {clientProducts.map((p) => {
                                const img = p.image_url || p.image || "/images/logo.png";
                                const href = `/public/product/${p.slug ?? p.id}`;
                                return (
                                    <div key={p.id ?? p.slug} className="col-6 col-md-3 mx-auto">
                                        <div className="card rounded-2 shadow-sm animate-hov">
                                            <img
                                                src={img}
                                                className="border-bottom"
                                                alt={p.name || p.title || "Product"}
                                                style={{
                                                    minHeight: "150px",
                                                    maxHeight: "150px",
                                                    borderTopLeftRadius: "4px",
                                                    borderTopRightRadius: "4px",
                                                    objectFit: "cover",
                                                    width: "100%",
                                                }}
                                            />
                                            <div className="py-4 px-3 text-start">
                                                <h3
                                                    className="fs-6 fw-bold"
                                                    style={{
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 1,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {p.name || p.title || p.slug}
                                                </h3>
                                                <p
                                                    className="fs-6 fw-light text-secondary"
                                                    style={{
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 1,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {(p.description ?? p.teaser ?? p.summary ?? "").toString()}
                                                </p>
                                                <a href={href} className="fw-bold text-orange text-decoration-none">Read More</a>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {clientProducts.length === 0 && (
                                <p className="txt14">No featured products available.</p>
                            )}
                        </div>
                        <a href="/public/products" className="btn btn-danger text-white fw-light fs-6 mt-5">See More..</a>
                    </div>

                </div>

                <CmsHtmlBlock
                    html={middleCmsHtml}
                    className="w-100 page-content cms-content"
                />

                {/* ── What's New Section ── */}
                <div className="w-100 cutter-section">

                    <div className="heading-block text-center border-0 mt-5 cutter-title" data-heading="W">
                        <h2 className="fs-1 fw-bold">What's New</h2>
                    </div>

                    <div className="work-slider mt-5">
                        {(() => {
                            const articles = news ?? [];

                            const slides: Slide[] = articles.length > 0
                                ? articles.map((a: any) => ({
                                    image: a.thumbnail_url
                                        ? a.thumbnail_url
                                        : (a.image_url ?? '/images/highlights/diamond_pvc.jpg'),
                                    title: a.name || a.title || '',
                                    desc: a.teaser || a.excerpt || '',
                                }))
                                : [
                                    {
                                        image: '/images/highlights/diamond_pvc.jpg',
                                        title: 'Quality PVC Products',
                                        desc: 'Durable, attractive PVC solutions for modern builds.'
                                    },
                                    {
                                        image: '/images/highlights/armstrong_pvc.jpg',
                                        title: 'Precision Manufacturing',
                                        desc: 'Engineered for strength and consistent performance.'
                                    },
                                    {
                                        image: '/images/highlights/blue_pvc.jpg',
                                        title: 'Trusted by Professionals',
                                        desc: 'Proven in large-scale and residential projects.'
                                    }
                                ];

                            return <Slider slides={slides} />;
                        })()}
                    </div>

                </div>

                {/* ── Product List CTA (before testimonials) ── */}
                <div
                    className="w-100 my-5 py-5 cutter-section home-product-cta"
                    style={{ background: "linear-gradient(90deg, #FF0000, #FF4500, #FFA500)" }}
                >
                    <h5 className="text-white text-center fs-2 mb-0">
                        We offer the best PVC solutions in the market. See our{" "}
                        <b>
                            <a href="/public/products" className="text-white fw-bold fs-3">Product List</a>
                        </b>
                    </h5>
                </div>

                {/* ── What Our Clients Say (GrapesJS CMS) ── */}
                {testimonialsHtml ? (
                    <div
                        ref={testimonialsRef}
                        className="w-100 cms-testimonials-root"
                        suppressHydrationWarning
                        dangerouslySetInnerHTML={{ __html: testimonialsHtml }}
                    />
                ) : null}

            </div>

            {/* Scoped styles for CMS-injected content */}
            <style jsx global>{`
                .cms-content img { max-width: 100%; height: auto; }
                .cms-content h1,
                .cms-content h2,
                .cms-content h3 { font-weight: bold; margin-bottom: 0.5rem; }
                .cms-content p { margin-bottom: 1rem; line-height: 1.7; }
                .cms-content a { color: #ff7b00; text-decoration: underline; }
                .cms-content ul,
                .cms-content ol { padding-left: 1.5rem; margin-bottom: 1rem; }
                .cms-content table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
                .cms-content table td,
                .cms-content table th { border: 1px solid #dee2e6; padding: 0.5rem 0.75rem; }

                .home-product-cta.cutter-section {
                    margin-bottom: 0 !important;
                }

                .cms-testimonials-root .ts-section {
                    margin-top: 0 !important;
                }

                .cms-testimonials-root .ts-arrow {
                    position: relative;
                    z-index: 2;
                    pointer-events: auto;
                    cursor: pointer;
                }

                .cms-testimonials-root .ts-wrap {
                    position: relative;
                    z-index: 1;
                }

                .cms-testimonials-root #tsViewport {
                    overflow: hidden;
                    width: 100%;
                }

                .cms-testimonials-root #tsTrack {
                    display: flex;
                    flex-wrap: nowrap;
                    gap: 24px;
                    transition: transform 0.45s ease;
                    will-change: transform;
                }

                .cms-testimonials-root .ts-slot {
                    flex: 0 0 auto;
                }

                .cms-testimonials-root .ts-arrow {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 2;
                    background: transparent;
                    border: none;
                    font-size: 2.5rem;
                    line-height: 1;
                    color: #414141;
                    cursor: pointer;
                }

                .cms-testimonials-root .ts-arrow-prev { left: 0; }
                .cms-testimonials-root .ts-arrow-next { right: 0; }

                .cms-testimonials-root .ts-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    border: none;
                    background: #e6e6e6;
                    cursor: pointer;
                }

                .cms-testimonials-root .ts-dot.active {
                    background: #ff7b00;
                }
            `}</style>
        </div>
    );
}

Home.Layout = LandingPageLayout;