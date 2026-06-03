(function () {
  const namespace = (window.PaperComment = window.PaperComment || {});

  function normalizeArxivId(rawId) {
    if (!rawId) return null;
    return rawId
      .replace(/^arxiv:/i, "")
      .replace(/\.pdf$/i, "")
      .trim();
  }

  function getMetaContent(name) {
    const selector = [
      `meta[name="${name}"]`,
      `meta[property="${name}"]`
    ].join(",");
    const element = document.querySelector(selector);
    return element ? element.getAttribute("content") : null;
  }

  function getFirstMetaContent(names) {
    for (const name of names) {
      const value = getMetaContent(name);
      if (value) return value;
    }
    return null;
  }

  function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeDoi(rawDoi) {
    if (!rawDoi) return null;
    const cleaned = rawDoi
      .replace(/^doi:\s*/i, "")
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .trim()
      .replace(/[.,;)\]}]+$/g, "");

    const match = cleaned.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    return match ? match[0].toLowerCase() : null;
  }

  function findDoiInPage() {
    const metaDoi = getFirstMetaContent([
      "citation_doi",
      "dc.identifier",
      "DC.Identifier",
      "dc.Identifier",
      "prism.doi",
      "doi",
      "article:doi",
      "evt-doiPage"
    ]);
    const normalizedMetaDoi = normalizeDoi(metaDoi);
    if (normalizedMetaDoi) return normalizedMetaDoi;

    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    const normalizedCanonicalDoi = normalizeDoi(canonical);
    if (normalizedCanonicalDoi) return normalizedCanonicalDoi;

    const pageText = document.body?.innerText || "";
    const textMatch = pageText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    return normalizeDoi(textMatch ? textMatch[0] : null);
  }

  function getPaperTitle(fallback) {
    const metaTitle = getFirstMetaContent([
      "citation_title",
      "dc.title",
      "DC.Title",
      "og:title",
      "twitter:title"
    ]);
    return cleanText(metaTitle || document.title || fallback);
  }

  function getPublisherSource(hostname) {
    const host = hostname.replace(/^www\./, "");
    const sourceByDomain = [
      ["arxiv.org", "arxiv"],
      ["pubmed.ncbi.nlm.nih.gov", "pubmed"],
      ["ncbi.nlm.nih.gov", "pmc"],
      ["biorxiv.org", "biorxiv"],
      ["medrxiv.org", "medrxiv"],
      ["nature.com", "springer-nature"],
      ["springer.com", "springer"],
      ["wiley.com", "wiley"],
      ["science.org", "science"],
      ["acs.org", "acs"],
      ["sciencedirect.com", "elsevier"],
      ["cell.com", "cell-press"],
      ["tandfonline.com", "taylor-francis"],
      ["oup.com", "oxford"],
      ["cambridge.org", "cambridge"],
      ["rsc.org", "rsc"],
      ["iop.org", "iop"],
      ["aip.org", "aip"],
      ["aps.org", "aps"],
      ["ieee.org", "ieee"],
      ["acm.org", "acm"],
      ["pnas.org", "pnas"],
      ["mdpi.com", "mdpi"],
      ["frontiersin.org", "frontiers"],
      ["plos.org", "plos"],
      ["elifesciences.org", "elife"],
      ["royalsocietypublishing.org", "royal-society"],
      ["sagepub.com", "sage"],
      ["annualreviews.org", "annual-reviews"],
      ["peerj.com", "peerj"],
      ["hindawi.com", "hindawi"],
      ["portlandpress.com", "portland-press"],
      ["asm.org", "asm"],
      ["physiology.org", "aps-physiology"],
      ["ametsoc.org", "ams"],
      ["uchicago.edu", "university-of-chicago-press"],
      ["degruyter.com", "de-gruyter"]
    ];

    const match = sourceByDomain.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
    return match ? match[1] : "doi";
  }

  function detectArxivPaper() {
    if (location.hostname !== "arxiv.org") return null;

    const pathMatch = location.pathname.match(/^\/(?:abs|pdf)\/([^/?#]+)/i);
    const metaId = getMetaContent("citation_arxiv_id");
    const arxivId = normalizeArxivId(metaId || (pathMatch ? pathMatch[1] : null));
    if (!arxivId) return null;

    const pageTitle = document.querySelector("h1.title")?.textContent || document.title;
    const title = (getPaperTitle(pageTitle) || "")
      .replace(/^Title:\s*/i, "")
      .trim();

    return {
      key: `arxiv:${arxivId}`,
      source: "arxiv",
      arxivId,
      title: title || `arXiv:${arxivId}`,
      url: location.href
    };
  }

  function detectDoiPaper() {
    const doi = findDoiInPage();
    if (!doi) return null;

    return {
      key: `doi:${doi}`,
      source: getPublisherSource(location.hostname),
      doi,
      title: getPaperTitle(`DOI:${doi}`),
      url: location.href
    };
  }

  function detectPaper() {
    return detectArxivPaper() || detectDoiPaper();
  }

  namespace.detectPaper = detectPaper;
})();
