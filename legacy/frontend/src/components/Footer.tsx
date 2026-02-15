import { Box, Container, Link, Stack, Typography } from '@mui/material';

// Production path helper
const getBasePath = () => window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '/static' : '';

// Social link component to reduce repetition
const SocialLink = ({ href, image, alt }: { href: string; image: string; alt: string }) => (
    <Link href={href} target="_blank" sx={{ mx: 2 }}>
        <Box component="img" src={`${getBasePath()}/logos/${image}.png`} alt={alt} height={30} />
    </Link>
);

const Footer = () => (
    <Box component="footer" sx={{ bgcolor: 'grey.100', py: 4, mt: 5 }}>
        <Container>
            <Stack spacing={2} alignItems="center">
                <Stack direction="row" justifyContent="center">
                    <SocialLink
                        href="https://github.com/rdettling/cfbsim"
                        image="github"
                        alt="GitHub"
                    />
                    <SocialLink
                        href="https://www.linkedin.com/in/ryandettling"
                        image="linkedin"
                        alt="LinkedIn"
                    />
                </Stack>
                <Typography>Built by Ryan Dettling</Typography>
            </Stack>
        </Container>
    </Box>
);

export default Footer;
