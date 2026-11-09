/**
 * Archivio dei video dei canali di casa.
 *
 * Alla fine di ogni partita ne parte uno a caso, pescato da tutti e
 * due i canali. Ogni voce dice da quale canale viene, cosi' la carta
 * di fine partita puo' portare al canale giusto.
 */

export const CHANNELS = {
    zerouno: {
        nome: 'ZeroUno Solution',
        url: 'https://www.youtube.com/@ZeroUnoSolution'
    },
    okazione: {
        nome: 'Agjensi Okazione',
        url: 'https://www.youtube.com/@agjensiokazione'
    }
};

export const ZEROUNO_VIDEOS = [
    { id: "N9LjtMdrhfc", title: "Telefono rubato, cosa fare? Le tue foto sono salve?", channel: "zerouno" },
    { id: "XoF_I6uazuU", title: "Si rompe il PC? E con i dati come fai?", channel: "zerouno" },
    { id: "pLdeIeBehck", title: "Come funziona un file ZIP?", channel: "zerouno" },
    { id: "J5IUAekrh-0", title: "Un giorno mamma non ci sarà più: a chi restano le sue foto?", channel: "zerouno" },
    { id: "9WOdCuXtQQg", title: "Ti alzi dalla scrivania? Blocca il PC in un secondo con Win + L", channel: "zerouno" },
    { id: "i2rxfcm2POg", title: "Aggiornare il telefono lo rallenta? Il rischio vero è rimandare", channel: "zerouno" },
    { id: "shgyvu7hn98", title: "Shitet shtëpi 2-katëshe në Vorë-Marqinet", channel: "okazione" },
    { id: "v6JTDlpA0P0", title: "Shitet super pronë në Shkozet, Durrës", channel: "okazione" },
    { id: "FDKdZoq6TaA", title: "Okazion në Korçë: shitet super hotel në Dardhë", channel: "okazione" },
    { id: "RV-oxcskcrU", title: "Vala Park, Durrës: 121 m² + garazh", channel: "okazione" },
    { id: "YoBFKwOX4fs", title: "Nostalgji nga fëmijëria: shtëpi e vjetër në Mnelë", channel: "okazione" },
    { id: "kX46tUueZKU", title: "Natyra mrekulli", channel: "okazione" }
];
