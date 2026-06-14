(function () {
  const namespace = (window.PaperComment = window.PaperComment || {});

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function safeDecode(value) {
    let decoded = String(value || "");
    for (let index = 0; index < 2; index += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch (error) {
        break;
      }
    }
    return decoded;
  }

  function getMetaContent(name) {
    const selector = [
      `meta[name="${name}"]`,
      `meta[property="${name}"]`,
      `meta[itemprop="${name}"]`
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

  function normalizeArxivId(rawId) {
    if (!rawId) return null;
    const cleaned = String(rawId)
      .replace(/^arxiv:\s*/i, "")
      .replace(/\.pdf$/i, "")
      .trim();
    const match = cleaned.match(/\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?/i);
    return match ? match[0] : null;
  }

  function normalizeDoi(rawDoi) {
    if (!rawDoi) return null;
    const cleaned = safeDecode(rawDoi)
      .replace(/^doi:\s*/i, "")
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .trim()
      .replace(/[.,;)\]}>"']+$/g, "");

    const match = cleaned.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    if (!match) return null;
    return match[0]
      .replace(/(?:\.full|\.pdf|\.epdf|\.abstract|\.html)$/i, "")
      .toLowerCase();
  }

  function normalizePii(rawPii) {
    if (!rawPii) return null;
    const match = safeDecode(rawPii).match(/\bS\d{15,18}\b/i);
    return match ? match[0].toLowerCase() : null;
  }

  function getSourceUrl() {
    try {
      const params = new URLSearchParams(location.search);
      const pdfViewerSource = params.get("src") || params.get("file");
      return pdfViewerSource ? safeDecode(pdfViewerSource) : location.href;
    } catch (error) {
      return location.href;
    }
  }

  function getSourceLocation() {
    try {
      return new URL(getSourceUrl());
    } catch (error) {
      return location;
    }
  }

  function getJsonLdObjects() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const objects = [];

    function collect(value) {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(collect);
        return;
      }
      if (typeof value !== "object") return;
      objects.push(value);
      if (value["@graph"]) collect(value["@graph"]);
      if (value.mainEntity) collect(value.mainEntity);
      if (value.isPartOf) collect(value.isPartOf);
    }

    for (const script of scripts) {
      try {
        collect(JSON.parse(script.textContent));
      } catch (error) {
        // Ignore invalid publisher JSON-LD.
      }
    }

    return objects;
  }

  function getJsonLdDoi() {
    for (const item of getJsonLdObjects()) {
      const doi = normalizeDoi(item.doi || item.identifier || item.sameAs || item.url);
      if (doi) return doi;
    }
    return null;
  }

  function getJsonLdTitle() {
    for (const item of getJsonLdObjects()) {
      const type = String(item["@type"] || "").toLowerCase();
      if (type.includes("scholarlyarticle") || type.includes("article") || item.doi) {
        const title = cleanText(item.headline || item.name);
        if (title) return title;
      }
    }
    return null;
  }

  function hasScholarlyMeta() {
    const scholarlyMetaNames = [
      "citation_title",
      "citation_journal_title",
      "citation_publication_date",
      "citation_author",
      "citation_doi",
      "citation_pmid",
      "citation_pmcid",
      "prism.publicationName",
      "prism.issn",
      "dc.type",
      "DC.Type",
      "dc.identifier",
      "DC.Identifier"
    ];

    if (scholarlyMetaNames.some((name) => getMetaContent(name))) return true;

    return getJsonLdObjects().some((item) => {
      const type = String(item["@type"] || "").toLowerCase();
      return type.includes("scholarlyarticle") || type.includes("medicalscholarlyarticle");
    });
  }

  function isKnownScholarlyHost(hostname) {
    const host = hostname.replace(/^www\./, "");
    const domains = [
      "arxiv.org",
      "doi.org",
      "crossref.org",
      "pubmed.ncbi.nlm.nih.gov",
      "ncbi.nlm.nih.gov",
      "biorxiv.org",
      "medrxiv.org",
      "researchsquare.com",
      "preprints.org",
      "ssrn.com",
      "osf.io",
      "nature.com",
      "springer.com",
      "springeropen.com",
      "biomedcentral.com",
      "wiley.com",
      "science.org",
      "acs.org",
      "sciencedirect.com",
      "cell.com",
      "thelancet.com",
      "nejm.org",
      "jamanetwork.com",
      "bmj.com",
      "lww.com",
      "karger.com",
      "thieme-connect.com",
      "liebertpub.com",
      "tandfonline.com",
      "oup.com",
      "cambridge.org",
      "rsc.org",
      "iop.org",
      "aip.org",
      "aps.org",
      "ieee.org",
      "acm.org",
      "pnas.org",
      "mdpi.com",
      "frontiersin.org",
      "plos.org",
      "elifesciences.org",
      "royalsocietypublishing.org",
      "sagepub.com",
      "annualreviews.org",
      "peerj.com",
      "hindawi.com",
      "jstage.jst.go.jp",
      "scielo.org",
      "scielo.br",
      "copernicus.org",
      "agu.org",
      "spiedigitallibrary.org",
      "optica.org",
      "worldscientific.com",
      "emerald.com",
      "microbiologyresearch.org",
      "sciopen.com",
      "sciengine.com",
      "sciencechina.com",
      "sciencechina.cn",
      "cpsjournals.cn",
      "ingentaconnect.com"
    ];

    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  function findDoiInPage() {
    const metaDoi = getFirstMetaContent([
      "citation_doi",
      "dc.identifier",
      "DC.Identifier",
      "dc.Identifier",
      "dc.relation.ispartof",
      "prism.doi",
      "doi",
      "article:doi",
      "evt-doiPage",
      "bepress_citation_doi"
    ]);
    const normalizedMetaDoi = normalizeDoi(metaDoi);
    if (normalizedMetaDoi) return normalizedMetaDoi;

    const jsonLdDoi = getJsonLdDoi();
    if (jsonLdDoi) return jsonLdDoi;

    const doiLinks = Array.from(document.querySelectorAll('a[href*="doi.org/"], link[href*="doi.org/"]'));
    for (const link of doiLinks) {
      const doi = normalizeDoi(link.href || link.getAttribute("href"));
      if (doi) return doi;
    }

    const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
    const normalizedCanonicalDoi = normalizeDoi(canonical);
    if (normalizedCanonicalDoi) return normalizedCanonicalDoi;

    if (!hasScholarlyMeta() && !isKnownScholarlyHost(location.hostname)) return null;

    const pageText = document.body?.innerText || "";
    const textMatch = pageText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    return normalizeDoi(textMatch ? textMatch[0] : null);
  }

  function isPdfLikeUrl(url) {
    const lowerUrl = safeDecode(url.href || String(url || "")).toLowerCase();
    const lowerPath = safeDecode(url.pathname || "").toLowerCase();
    return /\.pdf(?:$|[?#])/i.test(lowerUrl) ||
      lowerPath.endsWith(".pdf") ||
      /\/(?:doi\/)?(?:pdf|epdf|pdfdirect|pdfdownload|article-pdf)(?:\/|$)/i.test(lowerPath) ||
      /\/content\/pdf\//i.test(lowerPath) ||
      /\/pdfft(?:\/|$)/i.test(lowerPath) ||
      url.searchParams?.get("format")?.toLowerCase() === "pdf" ||
      url.searchParams?.get("download")?.toLowerCase() === "pdf";
  }

  function getPaperTitle(fallback) {
    const metaTitle = getFirstMetaContent([
      "citation_title",
      "dc.title",
      "DC.Title",
      "prism.title",
      "og:title",
      "twitter:title"
    ]);
    return cleanText(metaTitle || getJsonLdTitle() || document.querySelector("h1")?.textContent || document.title || fallback);
  }

  function getPublisherSource(hostname) {
    const host = hostname.replace(/^www\./, "");
    const sourceByDomain = [
      ["arxiv.org", "arxiv"],
      ["pubmed.ncbi.nlm.nih.gov", "pubmed"],
      ["ncbi.nlm.nih.gov", "pmc"],
      ["doi.org", "doi"],
      ["crossref.org", "crossref"],
      ["biorxiv.org", "biorxiv"],
      ["medrxiv.org", "medrxiv"],
      ["researchsquare.com", "research-square"],
      ["preprints.org", "preprints"],
      ["ssrn.com", "ssrn"],
      ["nature.com", "springer-nature"],
      ["springer.com", "springer"],
      ["springeropen.com", "springer-open"],
      ["biomedcentral.com", "bmc"],
      ["wiley.com", "wiley"],
      ["science.org", "science"],
      ["acs.org", "acs"],
      ["sciencedirect.com", "elsevier"],
      ["cell.com", "cell-press"],
      ["thelancet.com", "lancet"],
      ["nejm.org", "nejm"],
      ["jamanetwork.com", "jama"],
      ["bmj.com", "bmj"],
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
      ["jstage.jst.go.jp", "j-stage"],
      ["scielo.org", "scielo"],
      ["scielo.br", "scielo"],
      ["copernicus.org", "copernicus"],
      ["agu.org", "agu"],
      ["spiedigitallibrary.org", "spie"],
      ["optica.org", "optica"],
      ["worldscientific.com", "world-scientific"],
      ["emerald.com", "emerald"],
      ["microbiologyresearch.org", "microbiology-society"],
      ["sciopen.com", "sciopen"],
      ["sciengine.com", "sciengine"],
      ["sciencechina.com", "science-china"],
      ["sciencechina.cn", "science-china"],
      ["cpsjournals.cn", "cps"],
      ["ingentaconnect.com", "ingenta"]
    ];

    const match = sourceByDomain.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
    return match ? match[1] : "doi";
  }

  function detectArxivPaper() {
    const pathMatch = location.pathname.match(/^\/(?:abs|pdf)\/([^/?#]+)/i);
    const metaId = getMetaContent("citation_arxiv_id");
    const arxivId = normalizeArxivId(metaId || (location.hostname.endsWith("arxiv.org") && pathMatch ? pathMatch[1] : null));
    if (!arxivId) return null;

    const pageTitle = document.querySelector("h1.title")?.textContent || document.title;
    const title = getPaperTitle(pageTitle).replace(/^Title:\s*/i, "").trim();

    return {
      key: `arxiv:${arxivId}`,
      source: "arxiv",
      arxivId,
      title: title || `arXiv:${arxivId}`,
      url: location.href
    };
  }

  function detectPubmedPaper() {
    const pmid = getFirstMetaContent(["citation_pmid", "uid", "ncbi_uid"]) ||
      (location.hostname === "pubmed.ncbi.nlm.nih.gov" ? location.pathname.match(/\/(\d+)\/?/)?.[1] : null);
    if (!pmid) return null;

    return {
      key: `pubmed:${pmid}`,
      source: "pubmed",
      pubmedId: pmid,
      title: getPaperTitle(`PubMed:${pmid}`),
      url: location.href
    };
  }

  function detectPmcPaper() {
    const pmcid = getFirstMetaContent(["citation_pmcid", "pmcid"]) ||
      location.pathname.match(/\/pmc\/articles\/(PMC\d+)/i)?.[1];
    if (!pmcid) return null;

    return {
      key: `pmc:${pmcid.toUpperCase()}`,
      source: "pmc",
      pmcId: pmcid.toUpperCase(),
      title: getPaperTitle(`PMC:${pmcid.toUpperCase()}`),
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

  function detectPdfPaper() {
    const source = getSourceLocation();
    const sourceUrl = source.href || location.href;
    const isPdfUrl = isPdfLikeUrl(source);
    const hasPdfEmbed = document.contentType === "application/pdf" ||
      Boolean(document.querySelector('embed[type="application/pdf"], iframe[src$=".pdf"]'));
    if (!isPdfUrl && !hasPdfEmbed) return null;

    const arxivPathMatch = source.hostname.endsWith("arxiv.org")
      ? source.pathname.match(/^\/pdf\/([^/?#]+?)(?:\.pdf)?$/i)
      : null;
    const arxivId = normalizeArxivId(arxivPathMatch?.[1]);
    if (arxivId) {
      return {
        key: `arxiv:${arxivId}`,
        source: "arxiv",
        arxivId,
        title: getPaperTitle(`arXiv:${arxivId}`),
        url: sourceUrl
      };
    }

    const doi = normalizeDoi(sourceUrl) || findDoiInPage();
    if (doi) {
      return {
        key: `doi:${doi}`,
        source: getPublisherSource(source.hostname),
        doi,
        title: getPaperTitle(`DOI:${doi}`),
        url: sourceUrl
      };
    }

    const pii = normalizePii(source.pathname);
    if (pii) {
      return {
        key: `pii:${pii}`,
        source: "elsevier",
        pii,
        title: getPaperTitle(`PII:${pii.toUpperCase()}`),
        url: sourceUrl
      };
    }

    const title = cleanText(document.title || source.pathname.split("/").pop() || "PDF paper")
      .replace(/\.pdf\s*$/i, "");
    const stableUrl = sourceUrl.split("#")[0].replace(/[?&](download|forcedownload|utm_[^=]+)=[^&#]*/gi, "");
    return {
      key: `pdf:${stableUrl.toLowerCase()}`,
      source: getPublisherSource(source.hostname) || "pdf",
      title: title || "PDF paper",
      url: sourceUrl
    };
  }

  function detectPaper() {
    return detectArxivPaper() || detectDoiPaper() || detectPubmedPaper() || detectPmcPaper() || detectPdfPaper();
  }

  namespace.detectPaper = detectPaper;
})();
