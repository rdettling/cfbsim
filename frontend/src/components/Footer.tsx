import { Box, Container, Link } from '@mui/material';

const Footer = () => {
    return (
        <Box
            component="footer"
            sx={{
                bgcolor: 'grey.100',
                py: 4,
                mt: 5
            }}
        >
            <Container>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mb: 3
                    }}
                >
                    <Link
                        href="https://github.com/rdettling/cfbsim"
                        target="_blank"
                        sx={{ mx: 3 }}
                    >
                        <Box
                            component="img"
                            src="/logos/github.png"
                            alt="GitHub"
                            sx={{ width: 30 }}
                        />
                    </Link>
                    <Link
                        href="https://www.linkedin.com/in/ryandettling"
                        target="_blank"
                        sx={{ mx: 3 }}
                    >
                        <Box
                            component="img"
                            src="/logos/linkedin.png"
                            alt="LinkedIn"
                            sx={{ width: 30 }}
                        />
                    </Link>
                </Box>
                <Box
                    sx={{
                        textAlign: 'center',
                        mb: 0
                    }}
                >
                    Built by Ryan Dettling
                </Box>
            </Container>
        </Box>
    );
};

export default Footer;
