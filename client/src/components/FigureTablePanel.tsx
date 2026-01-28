import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Image,
  Table2,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  ImageIcon,
  X,
  ZoomIn,
} from 'lucide-react';
import { Link } from 'wouter';
import type { FigureTableRegion } from '../../../shared/types';

interface FigureTablePanelProps {
  paperId: string;
  regions: FigureTableRegion[];
  className?: string;
}

export function FigureTablePanel({ paperId, regions, className = '' }: FigureTablePanelProps) {
  const [expandedType, setExpandedType] = useState<'all' | 'figure' | 'table'>('all');
  const [previewRegion, setPreviewRegion] = useState<FigureTableRegion | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position and update navigation state
  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  // Update scroll state on mount and when regions change
  useEffect(() => {
    updateScrollState();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollState);
      // Also update on resize
      const resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(container);
      return () => {
        container.removeEventListener('scroll', updateScrollState);
        resizeObserver.disconnect();
      };
    }
  }, [updateScrollState, regions, expandedType]);

  // Scroll by a fixed amount
  const scroll = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 320; // Approximately 2 cards
    const newScrollLeft = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    });
  }, []);

  // Group by type
  const figures = regions.filter(r => r.type === 'figure');
  const tables = regions.filter(r => r.type === 'table');

  // Filter based on selection
  const filteredRegions = expandedType === 'all'
    ? regions
    : regions.filter(r => r.type === expandedType);

  // Sort by page number and label
  const sortedRegions = [...filteredRegions].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });

  if (regions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-500" />
            Figures & Tables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No figures or tables marked yet</p>
            <p className="text-xs mt-1">
              Mark figures and tables in Reading Mode to see them here
            </p>
            <Link href={`/paper/${paperId}/read`}>
              <Button variant="outline" size="sm" className="mt-3">
                Enter Reading Mode
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-500" />
              Figures & Tables
              <Badge variant="secondary" className="ml-2">
                {regions.length}
              </Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant={expandedType === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setExpandedType('all')}
                className="h-7 px-2 text-xs"
              >
                All
              </Button>
              <Button
                variant={expandedType === 'figure' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setExpandedType('figure')}
                className="h-7 px-2 text-xs"
              >
                <Image className="w-3 h-3 mr-1" />
                {figures.length}
              </Button>
              <Button
                variant={expandedType === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setExpandedType('table')}
                className="h-7 px-2 text-xs"
              >
                <Table2 className="w-3 h-3 mr-1" />
                {tables.length}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Horizontal scrolling gallery with navigation */}
          <div className="relative group/gallery">
            {/* Left navigation arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 opacity-0 group-hover/gallery:opacity-100 -translate-x-1/2 hover:scale-110"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
            )}

            {/* Right navigation arrow */}
            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 opacity-0 group-hover/gallery:opacity-100 translate-x-1/2 hover:scale-110"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
            )}

            {/* Gradient fade edges when scrollable */}
            {canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10 pointer-events-none" />
            )}
            {canScrollRight && (
              <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10 pointer-events-none" />
            )}

            {/* Scrollable container */}
            <div
              ref={scrollContainerRef}
              className="flex gap-4 pb-4 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent hover:scrollbar-thumb-slate-400 dark:hover:scrollbar-thumb-slate-500"
              style={{ scrollbarWidth: 'thin' }}
            >
              {sortedRegions.map((region) => (
                <div
                  key={region.id}
                  className="group relative flex-shrink-0 cursor-pointer"
                  onClick={() => setPreviewRegion(region)}
                >
                  {/* Card with hover zoom effect */}
                  <div className="relative w-40 h-32 rounded-xl overflow-hidden border-2 border-transparent bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-md transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl hover:border-purple-400 dark:hover:border-purple-500 hover:z-10">
                    {/* Image or placeholder */}
                    {region.imageData ? (
                      <img
                        src={region.imageData}
                        alt={region.label}
                        className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${
                        region.type === 'figure'
                          ? 'bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-800/30'
                          : 'bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/50 dark:to-green-800/30'
                      }`}>
                        {region.type === 'figure' ? (
                          <Image className="w-10 h-10 text-blue-400 dark:text-blue-500 transition-transform duration-300 group-hover:scale-110" />
                        ) : (
                          <Table2 className="w-10 h-10 text-green-400 dark:text-green-500 transition-transform duration-300 group-hover:scale-110" />
                        )}
                      </div>
                    )}

                    {/* Hover overlay with zoom icon */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="bg-white/90 dark:bg-slate-800/90 rounded-full p-2 transform scale-50 group-hover:scale-100 transition-transform duration-300">
                        <ZoomIn className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>

                    {/* Type badge */}
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-md ${
                      region.type === 'figure' ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {region.type === 'figure' ? 'Fig' : 'Tab'}
                    </div>

                    {/* Page badge */}
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/70 text-white shadow-md">
                      P{region.pageNumber}
                    </div>
                  </div>

                  {/* Label below card */}
                  <div className="mt-2 text-center max-w-40">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {region.label}
                    </p>
                    {region.caption && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {region.caption}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Link to reading mode */}
          <div className="mt-4 pt-3 border-t text-center">
            <Link href={`/paper/${paperId}/read`}>
              <Button variant="outline" size="sm">
                View All in Reading Mode
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewRegion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewRegion(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  previewRegion.type === 'figure'
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    : 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                }`}>
                  {previewRegion.type === 'figure' ? (
                    <Image className="w-5 h-5" />
                  ) : (
                    <Table2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                    {previewRegion.label}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Page {previewRegion.pageNumber}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setPreviewRegion(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Image */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex-1 overflow-y-auto min-h-0">
              {previewRegion.imageData ? (
                <img
                  src={previewRegion.imageData}
                  alt={previewRegion.label}
                  className="max-w-full max-h-[55vh] mx-auto rounded-lg shadow-lg object-contain"
                />
              ) : (
                <div className={`w-full h-64 flex items-center justify-center rounded-lg ${
                  previewRegion.type === 'figure'
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'bg-green-100 dark:bg-green-900/30'
                }`}>
                  {previewRegion.type === 'figure' ? (
                    <Image className="w-16 h-16 text-blue-400" />
                  ) : (
                    <Table2 className="w-16 h-16 text-green-400" />
                  )}
                </div>
              )}
            </div>

            {/* Caption and Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              {previewRegion.caption && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  {previewRegion.caption}
                </p>
              )}
              <div className="flex justify-end">
                <Link href={`/paper/${paperId}/read?highlight=${previewRegion.type}&page=${previewRegion.pageNumber}&regionId=${previewRegion.id}`}>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View in PDF Reader
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FigureTablePanel;
