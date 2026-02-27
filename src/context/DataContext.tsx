import { createContext, useContext, useState, ReactNode } from 'react';
import Papa from 'papaparse';

export type ReportType = 'clicks' | 'commission' | 'orders' | 'unknown' | 'multiple';
export type DateFilterStr = 'today' | 'yesterday' | 'anteontem' | '7days' | '30days' | 'all' | 'custom';
export interface CustomDateRange { start: string; end: string }

export interface DataContextType {
    commissionData: any[];
    clickData: any[];
    fileName: string;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    reportType: ReportType;
    clearData: () => void;
    dateFilter: DateFilterStr;
    setDateFilter: (filter: DateFilterStr) => void;
    customRange: CustomDateRange;
    setCustomRange: (range: CustomDateRange) => void;
    hasStartedAnalysis: boolean;
    setHasStartedAnalysis: (val: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
    const [commissionData, setCommissionData] = useState<any[]>([]);
    const [clickData, setClickData] = useState<any[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [reportType, setReportType] = useState<ReportType>('unknown');
    const [dateFilter, setDateFilter] = useState<DateFilterStr>('all');
    const [customRange, setCustomRange] = useState<CustomDateRange>({ start: '', end: '' });
    const [hasStartedAnalysis, setHasStartedAnalysis] = useState<boolean>(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const firstRow = results.data[0] as any;
                    if (firstRow['ID dos Cliques']) {
                        setClickData(results.data);
                        setReportType(prev => prev === 'commission' ? 'multiple' : 'clicks');
                    } else if (firstRow['ID do pedido'] && firstRow['Comissão líquida do afiliado(R$)']) {
                        setCommissionData(results.data);
                        setReportType(prev => prev === 'clicks' ? 'multiple' : 'commission');
                    } else if (firstRow['Order ID'] || firstRow['Total Commission']) {
                        setReportType('orders');
                        // Optional fallback support for other structures
                    } else {
                        setReportType('unknown');
                    }
                },
            });
        }
    };

    const clearData = () => {
        setCommissionData([]);
        setClickData([]);
        setFileName('');
        setReportType('unknown');
        setHasStartedAnalysis(false);
    };

    return (
        <DataContext.Provider value={{
            commissionData, clickData, fileName, handleFileUpload, reportType, clearData,
            dateFilter, setDateFilter, customRange, setCustomRange, hasStartedAnalysis, setHasStartedAnalysis
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
