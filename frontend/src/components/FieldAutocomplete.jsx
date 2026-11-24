import React from 'react';
import CustomAutocomplete from './CustomAutocomplete';

export default function FieldAutocomplete(props) {
    const { listType, ...rest } = props;

    let fetchUrl = '';
    let mapData = (data) => [];

    if (listType === 'airport') {
        fetchUrl = '/api/locations/airports';
        mapData = (data) => {
            const seen = new Map();
            data.forEach(apt => {
                const code = apt.iataCode || apt.code;
                if (!code) return;
                const subtitle = `${apt.cityName || apt.name} - ${apt.airportName || apt.name}`;
                // Keep entry with longer/more complete subtitle
                if (!seen.has(code) || subtitle.length > seen.get(code).subtitle.length) {
                    seen.set(code, {
                        title: code,
                        subtitle,
                        searchKey: apt.cityName || apt.name,
                        countryCode: apt.countryCode || apt.country || '',
                    });
                }
            });
            return Array.from(seen.values());
        };
    
    } else if (listType === 'city') {
        fetchUrl = '/api/locations/cities';
        mapData = (data) => data.map(c => ({
            title: c.cityName,
            subtitle: c.iataCode || '',
            searchKey: c.cityName
        }));
    } else if (listType === 'state') {
        fetchUrl = '/api/locations/states';
        mapData = (data) => data.map(s => ({
            title: s.stateCode,
            subtitle: s.stateName,
            searchKey: s.stateName
        }));
    } else if (listType === 'airline-code') {
        fetchUrl = '/api/masters/airlines';
        mapData = (data) => data.map(al => ({
            title: al.code2 || al.code,
            subtitle: al.name,
            searchKey: al.name
        }));
    } else if (listType === 'airline-name') {
        fetchUrl = '/api/masters/airlines';
        mapData = (data) => data.map(al => ({
            title: al.name,
            subtitle: `${al.code2 || al.code} - ${al.prefix}`,
            searchKey: al.code2 || al.code
        }));
    } else if (listType === 'awb-stock') {
        if (!props.airlinePrefix || props.airlinePrefix.length < 3) {
            fetchUrl = null;
        } else {
            fetchUrl = `/api/stock/list?prefix=${props.airlinePrefix}&status=AVAILABLE`;
        }
        mapData = (data) => data.map(s => ({
            title: `${s.sequenceNumber}${s.checkDigit}`,
            searchKey: `${s.sequenceNumber}${s.checkDigit}`
        }));
    } else if (listType === 'hawb-stock') {
        fetchUrl = '/api/stock/hawb/list?status=AVAILABLE';
        mapData = (data) => data.map(s => ({
            title: s.fullHawbNumber,
            searchKey: s.fullHawbNumber
        }));
    } else if (listType === 'awb-existing') {
        fetchUrl = '/api/awb/list';
        mapData = (data) => data.map(awb => ({
            title: awb.hawbNumber ? awb.hawbNumber : awb.awbNumber,
            subtitle: awb.type + (awb.hawbNumber ? ` (Master: ${awb.awbNumber})` : ''),
            searchKey: awb.hawbNumber ? awb.hawbNumber : awb.awbNumber
        }));
    } else if (listType === 'currency') {
        fetchUrl = '/api/masters/currencies';
        mapData = (data) => data.map(c => ({
            title: c.currencyCode || c.code,
            subtitle: c.currencyName || c.name,
            searchKey: c.currencyName || c.name
        }));
    } else if (listType === 'country') {
        fetchUrl = '/api/masters/countries';
        mapData = (data) => data.map(c => ({
            title: c.code,
            subtitle: c.name,
            searchKey: c.name
        }));
        } else if (listType === 'charge') {
        fetchUrl = '/api/masters/charges';
        mapData = (data) => data.filter(c => c.isActive !== false).map(c => ({
            title: c.awbChargeCode || c.code,
            subtitle: c.awbChargeName || c.name,
            searchKey: c.awbChargeName || c.name
        }));
} else if (listType === 'sph') {
        fetchUrl = '/api/masters/specialhandlingcodes';
        mapData = (data) => data.map(s => ({
            title: s.code,
            subtitle: s.description,
            searchKey: s.description
        }));
    } else if (listType === 'iata-agent') {
        fetchUrl = '/api/masters/iataagents';
        mapData = (data) => data.map(i => ({
            title: i.name,
            subtitle: i.iataCode,
            iataCode: i.iataCode,
            place: (function(){ try { const b=JSON.parse(i.branches); return (b&&b.length>0)?b[0].city:"" } catch(e){return ""} })(),
            searchKey: i.name
        }));
    } else if (listType === 'party') {
        fetchUrl = '/api/masters/parties';
        mapData = (data) => data.map(p => ({
            ...p,
            title: p.name,
            subtitle: p.city,
            searchKey: p.name
        }));
    } else {
        // Fallback for native input
        return <input {...rest} />;
    }

        return (
        <CustomAutocomplete
            fetchUrl={fetchUrl}
            mapData={mapData}
            enforceSelection={['airport', 'airline-code', 'currency', 'country'].includes(listType)}
            {...rest}
        />
    );
}
